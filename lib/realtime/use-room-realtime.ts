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
    let channel: RealtimeChannel | null = null
    let poll: ReturnType<typeof setInterval> | null = null

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

    ;(async () => {
      // CRITICAL: authorize the realtime socket with the user's JWT, otherwise
      // RLS (is_room_member via auth.uid()) silently drops every change event.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token)
      }
      if (!active) return

      const filter = `room_id=eq.${roomId}`
      channel = supabase
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
          const ids = Object.keys(channel?.presenceState() ?? {})
          setPresent(ids)
        })
        .subscribe(async (status) => {
          setConnected(status === 'SUBSCRIBED')
          if (status === 'SUBSCRIBED' && meId) {
            await channel?.track({ user_id: meId, at: Date.now() })
          }
        })
    })()

    // Safety-net poll: realtime is primary, but a light refetch guarantees the
    // board converges even if a change event is missed or the socket drops.
    poll = setInterval(reload, 3500)

    return () => {
      active = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (poll) clearInterval(poll)
      if (channel) supabase.removeChannel(channel)
    }
  }, [roomId, meId, setSnapshot, setConnected, setPresent])
}
