'use client'

import { create } from 'zustand'
import type { HandCardRow, HandRow, SeatRow } from '@/lib/supabase/types'
import type { RoomSnapshot } from '@/lib/realtime/fetch-room'

export interface HandWithCards extends HandRow {
  cards: HandCardRow[]
}

interface RoomStore extends RoomSnapshot {
  /** Auth user id of the local player (null until known). */
  meId: string | null
  connected: boolean
  /** seat ids currently present (from Realtime Presence). */
  presentUserIds: string[]

  setSnapshot: (s: RoomSnapshot) => void
  setMeId: (id: string | null) => void
  setConnected: (c: boolean) => void
  setPresent: (ids: string[]) => void

  // Derived helpers
  handsWithCards: () => HandWithCards[]
  mySeat: () => SeatRow | null
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  room: null,
  config: null,
  seats: [],
  round: null,
  hands: [],
  cards: [],
  settlement: null,
  interimSettlement: null,
  meId: null,
  connected: false,
  presentUserIds: [],

  setSnapshot: (s) => set(s),
  setMeId: (meId) => set({ meId }),
  setConnected: (connected) => set({ connected }),
  setPresent: (presentUserIds) => set({ presentUserIds }),

  handsWithCards: () => {
    const { hands, cards } = get()
    return hands
      .map((h) => ({
        ...h,
        cards: cards
          .filter((c) => c.hand_id === h.id)
          .sort((a, b) => a.card_index - b.card_index),
      }))
      .sort((a, b) => a.seat_order - b.seat_order)
  },

  mySeat: () => {
    const { seats, meId } = get()
    return seats.find((s) => s.user_id === meId && s.status !== 'left') ?? null
  },
}))
