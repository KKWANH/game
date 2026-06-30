import Link from 'next/link'
import { getUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { AdminClient } from '@/components/admin/AdminClient'

export default async function AdminPage() {
  const user = await getUser()

  if (!user || !isAdmin(user.email)) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">관리자 전용</h1>
        <p className="text-muted-foreground">이 페이지에 접근할 권한이 없습니다.</p>
        <Link href="/" className="text-gold hover:underline">
          ← 홈으로
        </Link>
      </main>
    )
  }

  return <AdminClient />
}
