'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label, Panel } from '@/components/ui/input'
import { updateDisplayName, signOut } from '@/actions/auth-actions'

export function AccountClient({
  email,
  name,
  avatarUrl,
  admin,
}: {
  email: string
  name: string
  avatarUrl: string | null
  admin: boolean
}) {
  const [displayName, setDisplayName] = useState(name)
  const [pending, setPending] = useState(false)

  async function save() {
    setPending(true)
    try {
      await updateDisplayName(displayName)
      toast.success('이름을 저장했습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">
          <span className="shimmer-gold">계정 설정</span>
        </h1>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 게임 선택
        </Link>
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
            관리자
          </Link>
        )}
      </Panel>

      <Panel className="space-y-3 p-5">
        <div className="space-y-1">
          <Label>표시 이름</Label>
          <Input
            value={displayName}
            maxLength={24}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="게임에서 보일 이름"
          />
          <p className="text-xs text-muted-foreground">새로 앉는 자리부터 이 이름이 표시됩니다.</p>
        </div>
        <Button
          variant="primary"
          className="w-full"
          disabled={pending || !displayName.trim() || displayName.trim() === name}
          onClick={save}
        >
          이름 저장
        </Button>
      </Panel>

      <form action={signOut}>
        <Button type="submit" variant="ghost" size="lg" className="w-full text-destructive">
          로그아웃
        </Button>
      </form>
    </main>
  )
}
