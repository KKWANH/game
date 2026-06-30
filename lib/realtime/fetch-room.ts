import type { BrowserDbClient } from '@/lib/supabase/browser'
import type {
  GameRoundRow,
  HandCardRow,
  HandRow,
  RoomConfigRow,
  RoomRow,
  SeatRow,
  SettlementRow,
} from '@/lib/supabase/types'

export interface RoomSnapshot {
  room: RoomRow | null
  config: RoomConfigRow | null
  seats: SeatRow[]
  round: GameRoundRow | null
  hands: HandRow[]
  cards: HandCardRow[]
  settlement: SettlementRow | null
  /** Most recent mid-game (kind='interim') settlement, if any. */
  interimSettlement: SettlementRow | null
}

/**
 * Pull the full sanitized public state for a room (RLS-scoped). This is the
 * canonical reconciliation source — clients call it on subscribe and on any
 * realtime change. The secret deck / hole card are never part of this.
 */
export async function fetchRoomSnapshot(
  supabase: BrowserDbClient,
  roomId: string
): Promise<RoomSnapshot> {
  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
  const { data: config } = await supabase
    .from('room_config')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle()
  const { data: seats } = await supabase
    .from('seats')
    .select('*')
    .eq('room_id', roomId)
    .order('seat_index')

  let round: GameRoundRow | null = null
  if (room?.current_round_id) {
    const { data } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('id', room.current_round_id)
      .maybeSingle()
    round = data
  }

  let hands: HandRow[] = []
  let cards: HandCardRow[] = []
  if (round) {
    const { data: h } = await supabase.from('hands').select('*').eq('round_id', round.id)
    hands = h ?? []
    if (hands.length) {
      const { data: c } = await supabase
        .from('hand_cards')
        .select('*')
        .in(
          'hand_id',
          hands.map((x) => x.id)
        )
      cards = c ?? []
    }
  }

  let settlement: SettlementRow | null = null
  if (room?.status === 'settled') {
    const { data } = await supabase
      .from('settlements')
      .select('*')
      .eq('room_id', roomId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    settlement = data
  }

  // Latest mid-game settlement so everyone sees "중간 정산 완료". Tolerate the
  // 0007 `kind` column not existing yet (error → just no interim banner).
  let interimSettlement: SettlementRow | null = null
  if (room && room.status !== 'settled') {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('room_id', roomId)
      .eq('kind', 'interim')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error) interimSettlement = data
  }

  return {
    room: room ?? null,
    config: config ?? null,
    seats: seats ?? [],
    round,
    hands,
    cards,
    settlement,
    interimSettlement,
  }
}
