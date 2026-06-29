import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import type { Database } from '@/lib/supabase/types'
import { createShoe, shuffle, type Card } from '@/lib/blackjack'
import { RoundPatch } from './types'

type Service = SupabaseClient<Database>

export class VersionConflict extends Error {
  constructor() {
    super('version_conflict')
  }
}

/**
 * Apply a patch atomically via the SECURITY DEFINER RPC. Throws VersionConflict
 * when another action won the race (caller should reload + retry or abort).
 */
export async function commitRound(
  service: Service,
  roundId: string,
  expectedVersion: number,
  patch: RoundPatch
): Promise<number> {
  const { data, error } = await service.rpc('commit_round_mutation', {
    p_round_id: roundId,
    p_expected_version: expectedVersion,
    p_patch: patch as unknown,
  })
  if (error) {
    if (error.code === '40001' || error.message.includes('version_conflict')) {
      throw new VersionConflict()
    }
    throw new Error(`commit failed: ${error.message}`)
  }
  return (data as { version: number }).version
}

/** Cryptographically-shuffled shoe for real dealing on the server. */
export function freshShoe(numDecks: number): Card[] {
  // crypto.randomInt is unbiased; wrap as a [0,1) rng for Fisher-Yates.
  const rng = () => randomInt(0, 2 ** 30) / 2 ** 30
  return shuffle(createShoe(numDecks), rng)
}
