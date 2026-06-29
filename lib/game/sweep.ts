import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { loadRoundState } from './load'
import { commitRound, VersionConflict } from './commit'
import { computeActionPatch, computeDealerSettlePatch } from './engine'

/**
 * Safety-net sweep: advance any round whose player turn deadline has passed by
 * auto-standing the active hand. Invoked by pg_cron (see 0002_rpcs.sql) so the
 * game keeps moving even when no client is connected to fire the timeout.
 * Returns the number of rounds advanced.
 */
export async function sweepExpiredTurns(): Promise<number> {
  const service = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: rounds } = await service
    .from('game_rounds')
    .select('id')
    .eq('phase', 'player_turns')
    .not('turn_deadline', 'is', null)
    .lt('turn_deadline', nowIso)

  if (!rounds || rounds.length === 0) return 0

  let advanced = 0
  for (const r of rounds) {
    try {
      const state = await loadRoundState(service, r.id)
      if (state.round.phase !== 'player_turns' || !state.round.active_hand_id) continue
      if (!state.round.turn_deadline || Date.now() < new Date(state.round.turn_deadline).getTime()) {
        continue
      }
      const { patch, enterDealer } = computeActionPatch(state, state.round.active_hand_id, 'stand')
      await commitRound(service, r.id, state.round.version, patch)
      advanced++

      if (enterDealer && state.round.dealer_hand_id) {
        const fresh = await loadRoundState(service, r.id)
        if (fresh.round.phase === 'dealer_turn') {
          const { patch: dpatch } = computeDealerSettlePatch(fresh, state.round.dealer_hand_id)
          await commitRound(service, r.id, fresh.round.version, dpatch)
        }
      }
    } catch (e) {
      if (e instanceof VersionConflict) continue // a client already advanced it
      // Don't let one bad round stop the sweep.
    }
  }
  return advanced
}
