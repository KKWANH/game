'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/browser'
import { useRoomStore } from '@/store/room-store'
import { fetchRoomSnapshot } from './fetch-room'

/**
 * Subscribes to the room's public-table changes via Supabase Realtime and
 * reconciles by refetching the full sanitized snapshot (debounced). Also tracks
 * presence so we can show who's connected. The secret deck never travels here —
 * the private schema is not in the Realtime publication.
 */
export function useRoomRealtime(roomId: string, meId: string | null) {
  const setSnapshot = useRoomStore((s) => s.setSnapshot)
  const setConnected = useRoomStore((s) => s.setConnected)
  const setMeId = useRoomStore((s) => s.setMeId)
  const setPresent = useRoomStore((s) => s.setPresent)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMeId(meId)
  }, [meId, setMeId])

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const reload = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const snap = await fetchRoomSnapshot(supabase, roomId)
        if (active) setSnapshot(snap)
      }, 70)
    }

    // Initial load.
    fetchRoomSnapshot(supabase, roomId).then((snap) => {
      if (active) setSnapshot(snap)
    })

    const filter = `room_id=eq.${roomId}`
    const channel: RealtimeChannel = supabase
      .channel(`room:${roomId}`, { config: { presence: { key: meId ?? 'anon' } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats', filter }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds', filter }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chip_ledger', filter }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter }, reload)
      // hands / hand_cards aren't room_id-filtered; listen unfiltered and reload.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hands' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hand_cards' }, reload)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const ids = Object.keys(state)
        setPresent(ids)
      })
      .subscribe(async (status) => {
        setConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED' && meId) {
          await channel.track({ user_id: meId, at: Date.now() })
        }
      })

    return () => {
      active = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [roomId, meId, setSnapshot, setConnected, setPresent])
}
