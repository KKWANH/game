import { getUser } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth-actions'
import { SignInButton } from '@/components/lobby/SignInButton'
import { CreateRoomForm } from '@/components/lobby/CreateRoomForm'
import { JoinRoomForm } from '@/components/lobby/JoinRoomForm'
import { Button } from '@/components/ui/button'

export default async function Home() {
  const user = await getUser()
  const name =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    user?.email?.split('@')[0]

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_-10%,color-mix(in_oklch,var(--accent)_22%,transparent),transparent)]" />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-12 sm:py-16">
        <div className="space-y-3 text-center">
          <div className="text-6xl">🃏</div>
          <h1 className="text-4xl font-extrabold sm:text-6xl">
            <span className="shimmer-gold">BLACKJACK</span>
          </h1>
          <p className="max-w-xl text-balance text-muted-foreground">
            친구끼리 즐기는 실시간 블랙잭. 가상 칩으로 베팅하고, 모든 판이 장부에 기록되며,
            마지막에 누가 누구에게 줄지 자동 정산됩니다.
          </p>
        </div>

        {!user ? (
          <div className="flex flex-col items-center gap-4">
            <SignInButton />
            <p className="text-xs text-muted-foreground">구글 계정으로 시작하세요</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-full border border-border bg-card/70 px-4 py-2">
              {user.user_metadata?.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.user_metadata.avatar_url as string}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              )}
              <span className="text-sm">
                <span className="text-muted-foreground">환영합니다, </span>
                <span className="font-bold">{name}</span>
              </span>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  로그아웃
                </Button>
              </form>
            </div>

            <div className="grid w-full gap-5 md:grid-cols-[1.4fr_1fr]">
              <CreateRoomForm />
              <JoinRoomForm />
            </div>
          </>
        )}

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          game.kwanho.dev · 실제 돈이 아닌 가상 칩으로 진행됩니다
        </footer>
      </div>
    </main>
  )
}
