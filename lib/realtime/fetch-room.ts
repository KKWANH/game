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
  // Independent reads run in parallel to keep each reconcile snappy.
  const [{ data: room }, { data: config }, { data: seats }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
    supabase.from('room_config').select('*').eq('room_id', roomId).maybeSingle(),
    supabase.from('seats').select('*').eq('room_id', roomId).order('seat_index'),
  ])

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

  // Final settlement (when settled) and latest interim (otherwise) — one or the
  // other, fetched in parallel. Interim tolerates the 0007 `kind` column absence.
  const [finalRes, interimRes] = await Promise.all([
    room?.status === 'settled'
      ? supabase.from('settlements').select('*').eq('room_id', roomId).order('computed_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    room && room.status !== 'settled'
      ? supabase.from('settlements').select('*').eq('room_id', roomId).eq('kind', 'interim').order('computed_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  const settlement: SettlementRow | null = finalRes.data
  const interimSettlement: SettlementRow | null = interimRes.error ? null : interimRes.data

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
