'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label, Panel } from '@/components/ui/input'
import { updateDisplayName, signOut } from '@/actions/auth-actions'
import type { PlayerStats } from '@/actions/social-actions'
import { useT } from '@/lib/i18n/provider'
import { LanguageToggle } from '@/components/i18n/LanguageToggle'
import { cn, formatChips } from '@/lib/utils'

export function AccountClient({
  email,
  name,
  avatarUrl,
  admin,
  stats,
}: {
  email: string
  name: string
  avatarUrl: string | null
  admin: boolean
  stats: PlayerStats
}) {
  const [displayName, setDisplayName] = useState(name)
  const [pending, setPending] = useState(false)
  const t = useT()

  async function save() {
    setPending(true)
    try {
      await updateDisplayName(displayName)
      toast.success(t('이름을 저장했습니다.'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('저장 실패'))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">
          <span className="shimmer-gold">{t('계정 설정')}</span>
        </h1>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t('← 게임 선택')}
          </Link>
        </div>
      </div>

      <Panel className="flex items-center gap-4 p-5">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-2xl">🙂</div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold">{name}</div>
          <div className="truncate text-sm text-muted-foreground">{email}</div>
        </div>
        {admin && (
          <Link
            href="/admin"
            className="ml-auto rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold"
          >
            {t('관리자')}
          </Link>
        )}
      </Panel>

      {/* Lifetime stats */}
      <Panel className="space-y-3 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gold">{t('내 통계')}</h2>
        {stats.hands === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">{t('아직 기록이 없어요.')}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label={t('판수')} value={formatChips(stats.hands)} />
              <Stat
                label={t('승률')}
                value={`${Math.round((stats.wins / Math.max(1, stats.wins + stats.losses)) * 100)}%`}
                accent
              />
              <Stat
                label={t('순손익')}
                value={`${stats.net > 0 ? '+' : ''}${formatChips(stats.net)}`}
                tone={stats.net > 0 ? 'up' : stats.net < 0 ? 'down' : undefined}
              />
            </div>
            <div className="flex justify-center gap-4 text-sm text-muted-foreground">
              <span>
                {t('승')} <b className="text-accent">{stats.wins}</b>
              </span>
              <span>
                {t('패')} <b className="text-destructive">{stats.losses}</b>
              </span>
              <span>
                {t('무')} <b className="text-foreground">{stats.pushes}</b>
              </span>
              <span>
                {t('블랙잭')} <b className="text-gold">{stats.blackjacks}</b>
              </span>
            </div>
          </>
        )}
      </Panel>

      <Panel className="space-y-3 p-5">
        <div className="space-y-1">
          <Label>{t('표시 이름')}</Label>
          <Input
            value={displayName}
            maxLength={24}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder={t('게임에서 보일 이름')}
          />
          <p className="text-xs text-muted-foreground">{t('새로 앉는 자리부터 이 이름이 표시됩니다.')}</p>
        </div>
        <Button
          variant="primary"
          className="w-full"
          disabled={pending || !displayName.trim() || displayName.trim() === name}
          onClick={save}
        >
          {t('이름 저장')}
        </Button>
      </Panel>

      <form action={signOut}>
        <Button type="submit" variant="ghost" size="lg" className="w-full text-destructive">
          {t('로그아웃')}
        </Button>
      </form>
    </main>
  )
}

function Stat({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 py-3">
      <div
        className={cn(
          'text-xl font-extrabold tabular-nums',
          tone === 'up' ? 'text-accent' : tone === 'down' ? 'text-destructive' : accent ? 'text-gold' : 'text-foreground'
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
