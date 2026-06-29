import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, GameRoundRow, HandCardRow, HandRow } from '@/lib/supabase/types'
import { LoadedHand, RoundState } from './types'

type Service = SupabaseClient<Database>

/** Load the full authoritative state for a round, including the secret shoe. */
export async function loadRoundState(
  service: Service,
  roundId: string
): Promise<RoundState> {
  const { data: round, error: re } = await service
    .from('game_rounds')
    .select('*')
    .eq('id', roundId)
    .single()
  if (re || !round) throw new Error('round not found')

  const [{ data: room }, { data: config }, { data: seats }, { data: hands }, { data: secrets }] =
    await Promise.all([
      service.from('rooms').select('*').eq('id', round.room_id).single(),
      service.from('room_config').select('*').eq('room_id', round.room_id).single(),
      service.from('seats').select('*').eq('room_id', round.room_id),
      service.from('hands').select('*').eq('round_id', roundId),
      // private schema — service-role only.
      service.schema('private').from('round_secrets').select('*').eq('round_id', roundId).single(),
    ])

  if (!room || !config || !seats || !hands) throw new Error('failed to load round state')

  const handIds = (hands as HandRow[]).map((h) => h.id)
  let cards: HandCardRow[] = []
  if (handIds.length) {
    const { data: c } = await service.from('hand_cards').select('*').in('hand_id', handIds)
    cards = (c as HandCardRow[]) ?? []
  }

  const loadedHands: LoadedHand[] = (hands as HandRow[]).map((h) => ({
    ...h,
    cards: cards.filter((c) => c.hand_id === h.id),
  }))

  return {
    room,
    config,
    round: round as GameRoundRow,
    seats,
    hands: loadedHands,
    deck: (secrets?.deck as { rank: string; suit: string }[]) ?? [],
    deckCursor: secrets?.deck_cursor ?? 0,
    dealerHoleCard: (secrets?.dealer_hole_card as { rank: string; suit: string } | null) ?? null,
  }
}
