'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/** Browser Supabase client — used for reads + Realtime subscriptions. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** The precise client type returned above (generic arity differs from the
 *  default `SupabaseClient<Database>`), for typing helper signatures. */
export type BrowserDbClient = ReturnType<typeof createClient>
