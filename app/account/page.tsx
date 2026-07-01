import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { AccountClient } from '@/components/account/AccountClient'
import { isAdmin } from '@/lib/admin'

export default async function AccountPage() {
  const user = await getUser()
  if (!user) redirect('/')
  const meta = user.user_metadata ?? {}
  const name =
    (meta.display_name as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    user.email?.split('@')[0] ||
    '플레이어'

  return (
    <AccountClient
      email={user.email ?? ''}
      name={name}
      avatarUrl={(meta.avatar_url as string) || (meta.picture as string) || null}
      admin={isAdmin(user.email)}
    />
  )
}
