import 'server-only'

import { getUser } from '@/lib/supabase/server'

export interface AuthedUser {
  id: string
  displayName: string
  avatarUrl: string | null
}

/** Require an authenticated user in a server action, with a friendly name. */
export async function requireUser(): Promise<AuthedUser> {
  const user = await getUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const meta = user.user_metadata ?? {}
  const displayName =
    meta.display_name || meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : '플레이어')
  return {
    id: user.id,
    displayName,
    avatarUrl: meta.avatar_url || meta.picture || null,
  }
}
