import Link from 'next/link'
import { getUser } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth-actions'
import { SignInButton } from '@/components/lobby/SignInButton'
import { Button } from '@/components/ui/button'
import { FloatingSuits } from '@/components/effects/FloatingSuits'
import { GameGrid } from '@/components/hub/GameGrid'

export default async function Home() {
  const user = await getUser()
  const name =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    user?.email?.split('@')[0]

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_-10%,color-mix(in_oklch,var(--accent)_20%,transparent),transparent)]" />
      <FloatingSuits />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 py-12 sm:py-20">
        <div className="flex w-full items-center justify-between">
          <span className="font-mono text-sm tracking-widest text-muted-foreground">game.kwanho.dev</span>
          {user ? (
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5">
              {user.user_metadata?.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.user_metadata.avatar_url as string} alt="" className="h-6 w-6 rounded-full" />
              )}
              <span className="max-w-[8rem] truncate text-sm font-semibold">{name}</span>
              <Link href="/account" className="text-xs text-muted-foreground hover:text-gold">
                계정
              </Link>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  로그아웃
                </Button>
              </form>
            </div>
          ) : (
            <SignInButton next="/" />
          )}
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            <span className="shimmer-gold">GAME CENTER</span>
          </h1>
          <p className="max-w-md text-balance leading-relaxed text-muted-foreground">
            친구들과 함께 즐기는 실시간 미니게임. 게임을 골라 입장하세요.
          </p>
        </div>

        <GameGrid />

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          가상 칩으로 진행됩니다 · 실제 돈이 아닙니다
        </footer>
      </div>
    </main>
  )
}
