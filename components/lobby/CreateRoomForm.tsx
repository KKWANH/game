'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label, Panel } from '@/components/ui/input'
import { CURRENCIES } from '@/lib/money'
import { createRoom, type CreateRoomInput } from '@/actions/room-actions'

export function CreateRoomForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [adv, setAdv] = useState(false)
  const [form, setForm] = useState<CreateRoomInput>({
    name: 'Blackjack',
    dealerType: 'ai',
    hostRole: 'player',
    numDecks: 6,
    minBet: 10,
    maxBet: 1000,
    blackjackPayout: '3:2',
    dealerHitsSoft17: false,
    maxSeats: 6,
    turnTimer: 30,
    startingChips: 1000,
    currency: 'KRW',
    unitChips: 1,
    unitAmount: 1,
  })

  const set = <K extends keyof CreateRoomInput>(k: K, v: CreateRoomInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function submit() {
    setPending(true)
    try {
      const { code } = await createRoom(form)
      toast.success('방 생성! 코드 ' + code)
      router.push(`/rooms/${code}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 실패')
      setPending(false)
    }
  }

  return (
    <Panel className="w-full space-y-4 p-5">
      <h2 className="text-lg font-bold">새 방 만들기</h2>

      <div className="space-y-1">
        <Label>방 이름</Label>
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Choice
          label="딜러"
          value={form.dealerType}
          onChange={(v) => set('dealerType', v as 'ai' | 'human')}
          options={[
            { v: 'ai', label: 'AI 딜러' },
            { v: 'human', label: '사람 딜러' },
          ]}
        />
        {form.dealerType === 'human' && (
          <Choice
            label="내 역할"
            value={form.hostRole}
            onChange={(v) => set('hostRole', v as 'player' | 'dealer')}
            options={[
              { v: 'player', label: '플레이어' },
              { v: 'dealer', label: '딜러(뱅크)' },
            ]}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Num label="시작 칩" value={form.startingChips!} onChange={(v) => set('startingChips', v)} />
        <Num label="최대 인원" value={form.maxSeats!} onChange={(v) => set('maxSeats', v)} min={1} max={7} />
      </div>

      <button
        type="button"
        onClick={() => setAdv((a) => !a)}
        className="text-xs font-medium text-muted-foreground transition hover:text-gold"
      >
        고급 설정 {adv ? '▴' : '▾'}
      </button>

      {adv && (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-background/40 p-3 sm:grid-cols-3">
            <Num label="최소 베팅" value={form.minBet!} onChange={(v) => set('minBet', v)} />
            <Num label="최대 베팅" value={form.maxBet!} onChange={(v) => set('maxBet', v)} />
            <Num label="덱 수" value={form.numDecks!} onChange={(v) => set('numDecks', v)} min={1} max={8} />
            <Num label="턴 제한(초)" value={form.turnTimer!} onChange={(v) => set('turnTimer', v)} min={5} max={120} />
            <Choice
              label="블랙잭 배당"
              value={form.blackjackPayout!}
              onChange={(v) => set('blackjackPayout', v as '3:2' | '6:5')}
              options={[
                { v: '3:2', label: '3:2' },
                { v: '6:5', label: '6:5' },
              ]}
            />
            <Choice
              label="딜러 소프트17"
              value={form.dealerHitsSoft17 ? 'hit' : 'stand'}
              onChange={(v) => set('dealerHitsSoft17', v === 'hit')}
              options={[
                { v: 'stand', label: '스탠드' },
                { v: 'hit', label: '히트' },
              ]}
            />
          </div>

          {/* Real-money stake — default 1코인 = 1원. */}
          <div className="space-y-1.5 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <Label>현실 머니 환율 (코인 단위)</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                type="number"
                className="w-20"
                min={1}
                value={form.unitChips!}
                onChange={(e) => set('unitChips', Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">코인 =</span>
              <Input
                type="number"
                className="w-20"
                min={0}
                step="any"
                value={form.unitAmount!}
                onChange={(e) => set('unitAmount', Number(e.target.value))}
              />
              <select
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                className="h-9 rounded-lg border border-input bg-background/60 px-2 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              정산 때 이 환율로 실제 금액이 표시됩니다. 나중에 방에서 바꿀 수 있어요.
            </p>
          </div>
        </>
      )}

      <Button variant="gold" size="lg" className="w-full" disabled={pending} onClick={submit}>
        방 만들기
      </Button>
    </Panel>
  )
}

function Num({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-1 rounded-lg border border-border bg-background/60 p-1">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              value === o.v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary/60'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
