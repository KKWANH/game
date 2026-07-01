'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Panel, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/provider'
import {
  listFriends,
  listMembers,
  sendFriendRequest,
  respondFriend,
  removeFriend,
  type Friend,
  type Member,
} from '@/actions/social-actions'

function Avatar({ src, name }: { src: string | null; name: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-7 w-7 shrink-0 rounded-full" />
  ) : (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm">
      {name.slice(0, 1)}
    </div>
  )
}

export function FriendsPanel() {
  const router = useRouter()
  const t = useT()
  const [data, setData] = useState<{ friends: Friend[]; incoming: Member[]; outgoing: Member[] } | null>(null)
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState<Member[] | null>(null)
  const [busy, setBusy] = useState(false)

  const loadFriends = useCallback(async () => {
    setData(await listFriends())
  }, [])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  // Debounced member search.
  useEffect(() => {
    const id = setTimeout(async () => {
      if (!query.trim()) return setMembers(null)
      setMembers(await listMembers(query))
    }, 300)
    return () => clearTimeout(id)
  }, [query])

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) toast.success(ok)
      await loadFriends()
      if (query.trim()) setMembers(await listMembers(query))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('실패'))
    } finally {
      setBusy(false)
    }
  }

  const memberBtn = (m: Member) => {
    if (m.status === 'friends') return <span className="text-xs text-accent">{t('친구')}</span>
    if (m.status === 'outgoing') return <span className="text-xs text-muted-foreground">{t('요청됨')}</span>
    if (m.status === 'incoming')
      return (
        <Button size="sm" variant="primary" disabled={busy} onClick={() => act(() => sendFriendRequest(m.id), t('친구 추가됨'))}>
          {t('수락')}
        </Button>
      )
    return (
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => sendFriendRequest(m.id), t('친구 요청 보냄'))}>
        {t('친구 추가')}
      </Button>
    )
  }

  return (
    <Panel className="w-full space-y-4 p-5">
      <h2 className="text-lg font-bold">{t('친구')}</h2>

      {/* Incoming requests */}
      {data && data.incoming.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-widest text-gold">{t('받은 요청')}</div>
          {data.incoming.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <Avatar src={m.avatar} name={m.name} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</span>
              <Button size="sm" variant="primary" disabled={busy} onClick={() => act(() => respondFriend(m.id, true), t('친구 추가됨'))}>
                {t('수락')}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => respondFriend(m.id, false))}>
                {t('거절')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div className="space-y-1.5">
        {data === null ? (
          <p className="py-3 text-center text-sm text-muted-foreground">{t('불러오는 중…')}</p>
        ) : data.friends.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">{t('아직 친구가 없어요. 아래에서 찾아보세요.')}</p>
        ) : (
          data.friends.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-2">
              <Avatar src={f.avatar} name={f.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className={f.roomCode ? 'text-xs text-accent' : 'text-xs text-muted-foreground'}>
                  {f.roomCode ? t('게임 중') : t('오프라인')}
                </div>
              </div>
              {f.roomCode && (
                <Button size="sm" variant="gold" disabled={busy} onClick={() => router.push(`/rooms/${f.roomCode}`)}>
                  {t('입장')}
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => removeFriend(f.id))}>
                ✕
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Find members */}
      <div className="space-y-2 border-t border-border pt-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('이름으로 멤버 찾기…')} />
        {members && (
          <div className="max-h-56 space-y-1.5 overflow-y-auto">
            {members.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">{t('일치하는 멤버가 없어요.')}</p>
            ) : (
              members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Avatar src={m.avatar} name={m.name} />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                  {memberBtn(m)}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}
