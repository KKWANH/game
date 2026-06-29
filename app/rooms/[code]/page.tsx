import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getUser } from '@/lib/supabase/server'
import { TableClient } from './table-client'
import { SignInButton } from '@/components/lobby/SignInButton'

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await getUser()

  if (!user) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <p className="text-muted-foreground">방 {code.toUpperCase()}에 입장하려면 로그인하세요.</p>
        <SignInButton next={`/rooms/${code}`} />
      </main>
    )
  }

  // Resolve the room by code (service role — page is auth-gated above).
  const service = createServiceClient()
  const { data: room } = await service
    .from('rooms')
    .select('id, status')
    .eq('code', code.toUpperCase())
    .maybeSingle()

  if (!room) redirect('/?not_found=1')

  return <TableClient roomId={room.id} meId={user.id} />
}
