import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * SERVICE-ROLE client. Bypasses RLS — full authority over game tables and the
 * private (secret deck / hole card) schema. NEVER import this from a client
 * component; the 'server-only' guard above turns that into a build error.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
