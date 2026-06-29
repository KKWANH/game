'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label, Panel } from '@/components/ui/input'
import { joinRoomByCode } from '@/actions/room-actions'

export function JoinRoomForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)

  async function submit() {
    if (code.trim().length < 4) return
    setPending(true)
    try {
      const res = await joinRoomByCode(code.trim())
      router.push(`/rooms/${res.code}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '입장 실패')
      setPending(false)
    }
  }

  return (
    <Panel className="w-full space-y-3 p-5">
      <h2 className="text-lg font-bold">코드로 입장</h2>
      <div className="space-y-1">
        <Label>초대 코드</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="예: K7M2QX"
          className="text-center font-mono text-lg tracking-[0.3em]"
          maxLength={6}
        />
      </div>
      <Button variant="primary" size="lg" className="w-full" disabled={pending} onClick={submit}>
        입장하기
      </Button>
    </Panel>
  )
}
