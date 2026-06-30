// Adversarial tester: sets up a live round, then tries to cheat/abuse the
// backend as anon, as a non-member, and as a logged-in member. Every attack
// must be BLOCKED; legitimate reads must still work. Cleans up after.
// Run: set -a; source .env.local; set +a; NODE_OPTIONS='--conditions=react-server' npx tsx scripts/qa/adversary.ts
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { loadRoundState } from '@/lib/game/load'
import { commitRound, freshShoe } from '@/lib/game/commit'
import { computeDealPatch, SEAT_ORDER_GAP } from '@/lib/game/engine'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc = createServiceClient()
const PW = 'devpassword123!'

let pass = 0, fail = 0
const ok = (m: string) => { console.log('  ✅ BLOCKED/OK:', m); pass++ }
const no = (m: string) => { console.log('  ❌ VULNERABLE:', m); fail++ }

async function makeUser(email: string, name: string) {
  await svc.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { full_name: name } })
  const signin = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data } = await signin.auth.signInWithPassword({ email, password: PW })
  const token = data.session!.access_token
  const client = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  return { id: data.user!.id, client }
}

/** Did a write cheat change anything? Re-read via service and compare. */
async function unchanged(table: string, col: string, id: string, before: unknown) {
  const { data } = await svc.from(table).select(col).eq('id', id).maybeSingle()
  return data && (data as Record<string, unknown>)[col] === before
}

async function main() {
  const ts = Date.now()
  console.log('\n[setup] users, room, seats, live round')
  const host = await makeUser(`adv_host_${ts}@test.local`, 'Host')
  const p2 = await makeUser(`adv_p2_${ts}@test.local`, 'Player2')
  const outsider = await makeUser(`adv_out_${ts}@test.local`, 'Outsider')

  const { data: room } = await svc.from('rooms').insert({ code: 'ADV' + (ts % 1000), name: 'adv', host_user_id: host.id, dealer_type: 'ai' }).select('*').single()
  await svc.from('room_config').insert({ room_id: room!.id, min_bet: 10, max_bet: 1000 })
  const { data: s1 } = await svc.from('seats').insert({ room_id: room!.id, seat_index: 0, user_id: host.id, display_name: 'Host' }).select('*').single()
  const { data: s2 } = await svc.from('seats').insert({ room_id: room!.id, seat_index: 1, user_id: p2.id, display_name: 'Player2' }).select('*').single()
  await svc.rpc('apply_buy_in', { p_seat_id: s1!.id, p_amount: 1000 })
  await svc.rpc('apply_buy_in', { p_seat_id: s2!.id, p_amount: 1000 })

  const { data: cfg } = await svc.from('room_config').select('*').eq('room_id', room!.id).single()
  const { data: round } = await svc.from('game_rounds').insert({ room_id: room!.id, round_number: 1, phase: 'betting', config_snapshot: cfg, version: 0 }).select('*').single()
  await svc.rpc('create_round_secret', { p_round_id: round!.id, p_deck: freshShoe(cfg!.num_decks) })
  await svc.from('rooms').update({ status: 'active', current_round_id: round!.id }).eq('id', room!.id)
  for (const s of [s1!, s2!]) {
    const { data: h } = await svc.from('hands').insert({ round_id: round!.id, seat_id: s.id, bet_amount: 100, status: 'betting', seat_order: s.seat_index * SEAT_ORDER_GAP }).select('id').single()
    await svc.rpc('record_chip_movement', { p_seat_id: s.id, p_round_id: round!.id, p_hand_id: h!.id, p_type: 'bet', p_amount: -100 })
  }
  const dealerHandId = crypto.randomUUID()
  const st = await loadRoundState(svc, round!.id)
  const { patch, holeCard } = computeDealPatch(st, dealerHandId)
  patch.insert_hands = [{ id: dealerHandId, round_id: round!.id, seat_id: null, is_dealer: true, status: 'active', seat_order: 999999 }, ...(patch.insert_hands ?? [])]
  await svc.rpc('set_dealer_hole_card', { p_round_id: round!.id, p_card: holeCard })
  await commitRound(svc, round!.id, st.round.version, patch)
  console.log('  live round ready (phase player_turns, hole card hidden)')

  const anon = createClient(URL, ANON, { auth: { persistSession: false } })

  console.log('\n[A] read the secret shoe / hole card')
  {
    const { error } = await anon.rpc('get_round_secret', { p_round_id: round!.id })
    error ? ok('anon get_round_secret') : no('anon read secret deck!')
    const { error: e2 } = await outsider.client.rpc('get_round_secret', { p_round_id: round!.id })
    e2 ? ok('authed-outsider get_round_secret') : no('outsider read secret deck!')
    const { error: e3 } = await p2.client.rpc('get_round_secret', { p_round_id: round!.id })
    e3 ? ok('authed-member get_round_secret') : no('member read secret deck!')
    const { data: ad } = await anon.schema('private').from('round_secrets').select('*').eq('round_id', round!.id)
    !ad || ad.length === 0 ? ok('anon private.round_secrets') : no('anon read private schema!')
    // Hole card must not be in the public hand_cards yet
    const { data: dc } = await svc.from('hand_cards').select('*').eq('hand_id', dealerHandId)
    ;(dc ?? []).length === 1 ? ok('dealer hole card absent from hand_cards') : no(`dealer has ${(dc ?? []).length} public cards (hole leaked!)`)
  }

  console.log('\n[B] outsider reads another room’s private state (RLS)')
  {
    const { data: r } = await outsider.client.from('game_rounds').select('*').eq('room_id', room!.id)
    ;(r ?? []).length === 0 ? ok('outsider game_rounds → 0 rows') : no('outsider read game_rounds!')
    const { data: h } = await outsider.client.from('hands').select('*').eq('round_id', round!.id)
    ;(h ?? []).length === 0 ? ok('outsider hands → 0 rows') : no('outsider read hands!')
    const { data: c } = await outsider.client.from('hand_cards').select('*')
    ;(c ?? []).length === 0 ? ok('outsider hand_cards → 0 rows') : no(`outsider read ${(c ?? []).length} hand_cards!`)
    const { data: led } = await outsider.client.from('chip_ledger').select('*').eq('room_id', room!.id)
    ;(led ?? []).length === 0 ? ok('outsider chip_ledger → 0 rows') : no('outsider read ledger!')
  }

  console.log('\n[C] member writes directly to game tables (RLS deny)')
  {
    // give myself chips
    const before = (await svc.from('seats').select('chip_stack').eq('id', s2!.id).single()).data!.chip_stack
    await p2.client.from('seats').update({ chip_stack: 999999 }).eq('id', s2!.id)
    await unchanged('seats', 'chip_stack', s2!.id, before) ? ok('member UPDATE seats.chip_stack (no effect)') : no('member changed own chip_stack!')

    // fake a payout ledger row
    const { error: le } = await p2.client.from('chip_ledger').insert({ room_id: room!.id, seat_id: s2!.id, type: 'payout', amount: 99999, balance_after: 99999 })
    le ? ok('member INSERT chip_ledger denied') : no('member inserted a fake payout!')

    // insert a free hand / extra card
    const { error: he } = await p2.client.from('hands').insert({ round_id: round!.id, seat_id: s2!.id, bet_amount: 0, status: 'active', seat_order: 5 })
    he ? ok('member INSERT hands denied') : no('member inserted a hand!')

    // drive the round directly
    const beforePhase = (await svc.from('game_rounds').select('phase').eq('id', round!.id).single()).data!.phase
    await p2.client.from('game_rounds').update({ phase: 'complete' }).eq('id', round!.id)
    await unchanged('game_rounds', 'phase', round!.id, beforePhase) ? ok('member UPDATE game_rounds (no effect)') : no('member changed round phase!')

    const { error: ce } = await anon.from('rooms').update({ status: 'closed' }).eq('id', room!.id)
    const stillActive = (await svc.from('rooms').select('status').eq('id', room!.id).single()).data!.status === 'active'
    ce || stillActive ? ok('anon UPDATE rooms (no effect)') : no('anon closed the room!')
  }

  console.log('\n[D] member calls privileged RPCs directly')
  {
    const { error: e1 } = await p2.client.rpc('commit_round_mutation', { p_round_id: round!.id, p_expected_version: 0, p_patch: {} })
    e1 ? ok('member commit_round_mutation denied') : no('member drove the game engine!')
    const { error: e2 } = await p2.client.rpc('apply_buy_in', { p_seat_id: s2!.id, p_amount: 100000 })
    const stack = (await svc.from('seats').select('chip_stack').eq('id', s2!.id).single()).data!.chip_stack
    e2 || stack < 100000 ? ok('member apply_buy_in denied') : no('member gave self chips via RPC!')
    const { error: e3 } = await p2.client.rpc('record_chip_movement', { p_seat_id: s2!.id, p_round_id: null, p_hand_id: null, p_type: 'payout', p_amount: 100000 })
    e3 ? ok('member record_chip_movement denied') : no('member moved chips via RPC!')
    const { error: e4 } = await p2.client.rpc('create_round_secret', { p_round_id: round!.id, p_deck: [] })
    e4 ? ok('member create_round_secret denied') : no('member rewrote the deck!')
  }

  console.log('\n[E] legitimate member access still works')
  {
    const { data: r } = await p2.client.from('game_rounds').select('*').eq('id', round!.id)
    ;(r ?? []).length === 1 ? ok('member CAN read their room’s round') : no('member blocked from own round!')
    const { data: c } = await p2.client.from('hand_cards').select('*')
    ;(c ?? []).length > 0 ? ok(`member CAN see ${(c ?? []).length} public cards`) : no('member cannot see any cards!')
  }

  console.log('\n[cleanup]')
  await svc.from('rooms').delete().eq('id', room!.id)
  for (const u of [host, p2, outsider]) await svc.auth.admin.deleteUser(u.id)
  console.log('  removed room + users')

  console.log(`\n=== ${pass} blocked/ok, ${fail} vulnerabilities ===`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
