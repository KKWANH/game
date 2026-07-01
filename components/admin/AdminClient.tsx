'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT, useLocale } from '@/lib/i18n/provider'
import {
  listAllRooms,
  adminCloseRoom,
  adminDeleteRoom,
  adminCloseEmptyRooms,
  type AdminRoom,
} from '@/actions/admin-actions'

const STATUS_STYLE: Record<string, string> = {
  lobby: 'bg-accent/15 text-accent',
  active: 'bg-gold/15 text-gold',
  settled: 'bg-secondary text-secondary-foreground',
  closed: 'bg-muted text-muted-foreground',
}

export function AdminClient() {
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null)
  const [busy, setBusy] = useState(false)
  const t = useT()
  const en = useLocale() === 'en'

  const load = useCallback(async () => {
    try {
      setRooms(await listAllRooms())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('불러오기 실패'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('실패'))
    } finally {
      setBusy(false)
    }
  }

  const openCount = rooms?.filter((r) => r.status === 'lobby' || r.status === 'active').length ?? 0
  const emptyCount = rooms?.filter((r) => (r.status === 'lobby' || r.status === 'active') && r.humans === 0).length ?? 0

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span className="shimmer-gold">{t('관리자')}</span>
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {en ? `${rooms?.length ?? 0} rooms · ${openCount} open` : `방 ${rooms?.length ?? 0}개 · 열림 ${openCount}`}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t('← 홈')}
          </Link>
          <Button size="sm" variant="ghost" disabled={busy} onClick={load}>
            {t('↻ 새로고침')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy || emptyCount === 0}
            onClick={() => {
              if (confirm(en ? `Close all ${emptyCount} empty rooms?` : `빈 방 ${emptyCount}개를 모두 닫을까요?`)) {
                run(() => adminCloseEmptyRooms(), t('빈 방 정리 완료'))
              }
            }}
          >
            {t('빈 방 모두 닫기')} ({emptyCount})
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b border-border bg-card/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:grid">
          <span>{t('방')}</span>
          <span className="w-16 text-center">{t('상태')}</span>
          <span className="w-20 text-center">{t('인원')}</span>
          <span className="w-24 text-center">{t('생성')}</span>
          <span className="w-28 text-right">{t('관리')}</span>
        </div>
        {rooms === null ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t('불러오는 중…')}</p>
        ) : rooms.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t('방이 없습니다.')}</p>
        ) : (
          rooms.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-1 gap-2 border-b border-border/60 px-4 py-3 last:border-0 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center sm:gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{r.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  👑 {r.hostName} · {r.dealerType === 'human' ? t('사람 딜러') : t('AI 딜러')}
                  {r.phase && ` · ${r.phase}`}
                </div>
              </div>
              <span className={cn('w-16 rounded-full px-2 py-0.5 text-center text-[11px] font-bold', STATUS_STYLE[r.status] ?? '')}>
                {r.status}
              </span>
              <span className="w-20 text-center text-sm tabular-nums">
                👤{r.humans}
                {r.ais > 0 && <span className="text-neon-cyan"> 🤖{r.ais}</span>}
              </span>
              <span className="w-24 text-center text-xs text-muted-foreground">
                {r.createdAt.slice(5, 16).replace('T', ' ')}
              </span>
              <div className="flex w-28 justify-end gap-1.5">
                {r.status !== 'closed' && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => adminCloseRoom(r.id), t('방 닫음'))}>
                    {t('닫기')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(en ? `Permanently delete room "${r.name}"?` : `"${r.name}" 방을 영구 삭제할까요?`)) run(() => adminDeleteRoom(r.id), t('방 삭제됨'))
                  }}
                >
                  {t('삭제')}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
