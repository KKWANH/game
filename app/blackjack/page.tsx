import Link from 'next/link'
import { getUser } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth-actions'
import { SignInButton } from '@/components/lobby/SignInButton'
import { CreateRoomForm } from '@/components/lobby/CreateRoomForm'
import { JoinRoomForm } from '@/components/lobby/JoinRoomForm'
import { RoomBrowser } from '@/components/lobby/RoomBrowser'
import { Button } from '@/components/ui/button'
import { FloatingSuits } from '@/components/effects/FloatingSuits'
import { Hero } from '@/components/lobby/Hero'
import { LanguageToggle } from '@/components/i18n/LanguageToggle'
import { getLocale } from '@/lib/i18n/locale'
import { tr } from '@/lib/i18n/dict'

export default async function BlackjackLobby() {
  const user = await getUser()
  const locale = await getLocale()
  const t = (s: string) => tr(s, locale)
  const name =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    user?.email?.split('@')[0]

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_-10%,color-mix(in_oklch,var(--accent)_22%,transparent),transparent)]" />
      <FloatingSuits />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-12 sm:py-16">
        <div className="flex w-full items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground transition hover:text-foreground">
            {t('← 게임 선택')}
          </Link>
          <LanguageToggle />
        </div>

        <div className="flex flex-col items-center gap-5 text-center">
          <Hero />
          <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
            <span className="shimmer-gold">BLACKJACK</span>
          </h1>
          <p className="max-w-md text-balance leading-relaxed text-muted-foreground">
            {t('친구끼리 즐기는 실시간 블랙잭.')}
            <br className="hidden sm:block" />
            {t('가상 칩으로 베팅하고, 모든 판이 장부에 기록되어 마지막에 자동 정산됩니다.')}
          </p>
        </div>

        {!user ? (
          <div className="flex flex-col items-center gap-4">
            <SignInButton next="/blackjack" />
            <p className="text-xs text-muted-foreground">{t('구글 계정으로 시작하세요')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-full border border-border bg-card/70 px-4 py-2">
              {user.user_metadata?.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.user_metadata.avatar_url as string} alt="" className="h-7 w-7 rounded-full" />
              )}
              <span className="text-sm">
                <span className="text-muted-foreground">{t('환영합니다, ')}</span>
                <span className="font-bold">{name}</span>
              </span>
              <Link href="/account" className="text-xs text-muted-foreground hover:text-gold">
                {t('계정')}
              </Link>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  {t('로그아웃')}
                </Button>
              </form>
            </div>

            <div className="grid w-full gap-5 md:grid-cols-[1.4fr_1fr]">
              <CreateRoomForm />
              <JoinRoomForm />
            </div>

            <RoomBrowser />
          </>
        )}

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          {t('game.kwanho.dev · 실제 돈이 아닌 가상 칩으로 진행됩니다')}
        </footer>
      </div>
    </main>
  )
}
