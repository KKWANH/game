// Scenario tester: seeds controlled decks to force blackjack/bust/double/split/
// surrender/insurance, drives them through the real server engine + RPCs, and
// asserts outcomes + ledger integrity. Run:
// set -a; source .env.local; set +a; NODE_OPTIONS='--conditions=react-server' npx tsx scripts/qa/scenarios.ts
import { createServiceClient } from '@/lib/supabase/service'
import { loadRoundState } from '@/lib/game/load'
import { commitRound } from '@/lib/game/commit'
import { computeDealPatch, computeActionPatch, computeDealerSettlePatch, SEAT_ORDER_GAP } from '@/lib/game/engine'
import type { Action, Rank, Suit } from '@/lib/blackjack'

const svc = createServiceClient()
let pass = 0, fail = 0
const ok = (m: string) => { console.log('  ✅', m); pass++ }
const no = (m: string) => { console.log('  ❌', m); fail++ }
const c = (s: string) => ({ rank: s.slice(0, s.length - 1) as Rank, suit: s.slice(-1) as Suit })
// Pad a seeded deck with low filler so the dealer never runs out when drawing.
// First filler is a 4, so a 16 dealer makes 20 and stands (doesn't reach 21).
const pad = (deck: string[]) => [...deck, '4C', '3D', '2H', '4S', '3C', '2D', '4H', '3S', '2C', '4D']

let userId = '', roomId = '', seatId = ''

async function setup() {
  const ts = Date.now()
  const u = await svc.auth.admin.createUser({ email: `scn_${ts}@test.local`, email_confirm: true })
  userId = u.data.user!.id
  const { data: room } = await svc.from('rooms').insert({ code: 'SCN' + (ts % 1000), name: 'scn', host_user_id: userId, dealer_type: 'ai' }).select('*').single()
  roomId = room!.id
  await svc.from('room_config').insert({ room_id: roomId, min_bet: 10, max_bet: 10000 })
  const { data: s } = await svc.from('seats').insert({ room_id: roomId, seat_index: 0, user_id: userId, display_name: 'P' }).select('*').single()
  seatId = s!.id
  await svc.rpc('apply_buy_in', { p_seat_id: seatId, p_amount: 100000 })
}

/** Start a round with a seeded deck, place a bet, deal. Returns ids. */
async function newRound(deck: string[], bet: number) {
  const { data: cfg } = await svc.from('room_config').select('*').eq('room_id', roomId).single()
  const last = (await svc.from('game_rounds').select('round_number').eq('room_id', roomId).order('round_number', { ascending: false }).limit(1).maybeSingle()).data
  const { data: round } = await svc.from('game_rounds').insert({ room_id: roomId, round_number: (last?.round_number ?? 0) + 1, phase: 'betting', config_snapshot: cfg, version: 0 }).select('*').single()
  await svc.rpc('create_round_secret', { p_round_id: round!.id, p_deck: deck.map(c) })
  await svc.from('rooms').update({ status: 'active', current_round_id: round!.id }).eq('id', roomId)
  const { data: h } = await svc.from('hands').insert({ round_id: round!.id, seat_id: seatId, bet_amount: bet, status: 'betting', seat_order: 0 * SEAT_ORDER_GAP }).select('id').single()
  await svc.rpc('record_chip_movement', { p_seat_id: seatId, p_round_id: round!.id, p_hand_id: h!.id, p_type: 'bet', p_amount: -bet })

  const dealerHandId = crypto.randomUUID()
  const st = await loadRoundState(svc, round!.id)
  const { patch, holeCard } = computeDealPatch(st, dealerHandId)
  patch.insert_hands = [{ id: dealerHandId, round_id: round!.id, seat_id: null, is_dealer: true, status: 'active', seat_order: 999999 }, ...(patch.insert_hands ?? [])]
  await svc.rpc('set_dealer_hole_card', { p_round_id: round!.id, p_card: holeCard })
  await commitRound(svc, round!.id, st.round.version, patch)
  return { roundId: round!.id as string, dealerHandId }
}

async function act(roundId: string, action: Action) {
  const st = await loadRoundState(svc, roundId)
  if (st.round.phase !== 'player_turns' || !st.round.active_hand_id) return st
  const { patch } = computeActionPatch(st, st.round.active_hand_id, action)
  await commitRound(svc, roundId, st.round.version, patch)
  return loadRoundState(svc, roundId)
}

async function standAll(roundId: string) {
  for (let i = 0; i < 8; i++) {
    const st = await loadRoundState(svc, roundId)
    if (st.round.phase !== 'player_turns' || !st.round.active_hand_id) break
    await act(roundId, 'stand')
  }
}

async function settle(roundId: string, dealerHandId: string) {
  const st = await loadRoundState(svc, roundId)
  if (st.round.phase === 'dealer_turn') {
    const { patch } = computeDealerSettlePatch(st, dealerHandId)
    await commitRound(svc, roundId, st.round.version, patch)
  }
}

async function playerHands(roundId: string) {
  const { data } = await svc.from('hands').select('*').eq('round_id', roundId).eq('is_dealer', false)
  return data ?? []
}
async function ledgerSum(roundId: string) {
  const { data } = await svc.from('chip_ledger').select('amount, type').eq('round_id', roundId)
  return (data ?? []).reduce((a, r) => a + r.amount, 0)
}

async function main() {
  await setup()

  // 1) Natural blackjack pays 3:2. p1=A,K; dealer up 9, hole 7 (=16 -> hits) draw 10 -> 26? give dealer 9,7 then 2 -> 18.
  console.log('\n[1] blackjack 3:2')
  {
    const { roundId, dealerHandId } = await newRound(pad(['AS','9C','KD','7H']), 100)
    await settle(roundId, dealerHandId) // natural -> straight to dealer+settle
    const h = (await playerHands(roundId))[0]
    h.outcome === 'blackjack' && h.payout === 250 ? ok(`blackjack: outcome=${h.outcome} payout=${h.payout}`) : no(`blackjack wrong: outcome=${h.outcome} payout=${h.payout}`)
  }

  // 2) Bust loses. p1=10,6=16; hit 10 -> 26 bust.
  console.log('\n[2] player bust loses')
  {
    const { roundId, dealerHandId } = await newRound(pad(['10S','9C','6D','7H','10C']), 100)
    await act(roundId, 'hit') // 16 -> +10 = 26 bust
    await settle(roundId, dealerHandId)
    const h = (await playerHands(roundId))[0]
    h.outcome === 'lose' && h.payout === 0 ? ok(`bust: ${h.status}/${h.outcome}/${h.payout}`) : no(`bust wrong: ${h.status}/${h.outcome}/${h.payout}`)
  }

  // 3) Double down. p1=5,6=11; dealer up 9 hole 7=16 -> hit 2 -> 18. double draw 10 -> 21 win, bet 200.
  console.log('\n[3] double down')
  {
    const { roundId, dealerHandId } = await newRound(pad(['5S','9C','6D','7H','10S']), 100)
    await act(roundId, 'double') // draw 10 -> 21, bet now 200
    await settle(roundId, dealerHandId)
    const h = (await playerHands(roundId))[0]
    h.is_doubled && h.bet_amount === 200 && h.outcome === 'win' && h.payout === 400 ? ok(`double: bet=${h.bet_amount} ${h.outcome} payout=${h.payout}`) : no(`double wrong: doubled=${h.is_doubled} bet=${h.bet_amount} ${h.outcome} payout=${h.payout}`)
  }

  // 4) Split a pair of 8s. deck: p1c1=8, up=6, p1c2=8, hole=10(=16 stand). splitA=3 (8+3=11), splitB=2 (8+2=10). then stand both. dealer 16 stands.
  console.log('\n[4] split pair')
  {
    const { roundId, dealerHandId } = await newRound(pad(['8S','6C','8D','10H','3S','2D']), 100)
    await act(roundId, 'split')
    await standAll(roundId)
    await settle(roundId, dealerHandId)
    const hs = await playerHands(roundId)
    const totalBet = hs.reduce((a, h) => a + h.bet_amount, 0)
    hs.length === 2 && totalBet === 200 ? ok(`split: ${hs.length} hands, total bet ${totalBet}`) : no(`split wrong: ${hs.length} hands, bet ${totalBet}`)
  }

  // 5) Surrender returns half. p1=10,6=16, dealer up 9.
  console.log('\n[5] surrender')
  {
    const { roundId, dealerHandId } = await newRound(pad(['10S','9C','6D','7H']), 100)
    await act(roundId, 'surrender')
    await settle(roundId, dealerHandId)
    const h = (await playerHands(roundId))[0]
    h.outcome === 'surrender' && h.payout === 50 ? ok(`surrender: ${h.outcome} payout=${h.payout}`) : no(`surrender wrong: ${h.status}/${h.outcome} payout=${h.payout}`)
  }

  // 6) Insurance pays 2:1 when dealer has blackjack. p1=10,7=17; dealer up A, hole K (BJ).
  console.log('\n[6] insurance vs dealer blackjack')
  {
    const { roundId, dealerHandId } = await newRound(pad(['10S','AC','7D','KH']), 100)
    // dealer up is Ace -> insurance offered. take it, then stand.
    await act(roundId, 'insurance')
    await standAll(roundId)
    await settle(roundId, dealerHandId)
    const h = (await playerHands(roundId))[0]
    const sum = await ledgerSum(roundId)
    // main: -100 bet, lose (0 payout); insurance: -50, +150 -> net 0
    h.insurance_bet === 50 && sum === 0 ? ok(`insurance: ins=${h.insurance_bet} round ledger net=${sum} (break-even vs dealer BJ)`) : no(`insurance wrong: ins=${h.insurance_bet} net=${sum} outcome=${h.outcome}`)
  }

  // 7) Ledger integrity: seat stack == sum of all ledger rows for the seat.
  console.log('\n[7] ledger integrity')
  {
    const { data: led } = await svc.from('chip_ledger').select('amount').eq('seat_id', seatId)
    const sum = (led ?? []).reduce((a, r) => a + r.amount, 0)
    const stack = (await svc.from('seats').select('chip_stack').eq('id', seatId).single()).data!.chip_stack
    sum === stack ? ok(`ledger sum (${sum}) == seat stack`) : no(`ledger ${sum} != stack ${stack}`)
  }

  console.log('\n[cleanup]')
  await svc.from('rooms').delete().eq('id', roomId)
  await svc.auth.admin.deleteUser(userId)

  console.log(`\n=== ${pass} passed, ${fail} failed ===`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
