'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRoomRealtime } from '@/lib/realtime/use-room-realtime'
import { useTurnTimer } from '@/lib/realtime/use-turn-timer'
import { useRoomStore } from '@/store/room-store'
import { SeatPod } from '@/components/table/SeatPod'
import { DealerArea } from '@/components/table/DealerArea'
import { CenterStage } from '@/components/game/CenterStage'
import { ActionBar } from '@/components/game/ActionBar'
import { BetControls } from '@/components/game/BetControls'
import { SettlementScreen } from '@/components/settlement/SettlementScreen'
import { HostSettlementPanel } from '@/components/game/HostSettlementPanel'
import { FloatingSuits } from '@/components/effects/FloatingSuits'
import { startRound, deal, nextRound } from '@/actions/game-actions'
import { takeSeat, buyIn } from '@/actions/room-actions'
import { formatChips } from '@/lib/utils'
import type { Card, Rank, Suit } from '@/lib/blackjack'

export function TableClient({ roomId, meId }: { roomId: string; meId: string }) {
  useRoomRealtime(roomId, meId)
  const room = useRoomStore((s) => s.room)
  const config = useRoomStore((s) => s.config)
  const seats = useRoomStore((s) => s.seats)
  const round = useRoomStore((s) => s.round)
  const settlement = useRoomStore((s) => s.settlement)
  const present = useRoomStore((s) => s.presentUserIds)
  const connected = useRoomStore((s) => s.connected)
  const handsWithCards = useRoomStore((s) => s.handsWithCards)
  const mySeat = useRoomStore((s) => s.mySeat)()

  const secondsLeft = useTurnTimer(round?.id ?? null, round?.turn_deadline ?? null, round?.phase ?? null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const hands = handsWithCards()
  const dealerHand = hands.find((h) => h.is_dealer) ?? null
  const dealerUpcard: Card | null = dealerHand?.cards[0]
    ? { rank: dealerHand.cards[0].rank as Rank, suit: dealerHand.cards[0].suit as Suit }
    : null

  const isHost = room?.host_user_id === meId
  const activeHandId = round?.active_hand_id ?? null
  const liveSeats = seats.filter((s) => s.status !== 'left')
  const playerSeats = liveSeats.filter((s) => !s.is_dealer)
  const dealerSeat = liveSeats.find((s) => s.is_dealer) ?? null
  const maxSeats = config?.max_seats ?? 6

  const myHands = mySeat ? hands.filter((h) => h.seat_id === mySeat.id && !h.is_dealer) : []
  const myActiveHand = myHands.find((h) => h.id === activeHandId) ?? null
  const myBetHand = myHands[0] ?? null

  const activeSeat = seats.find((s) => hands.some((h) => h.id === activeHandId && h.seat_id === s.id))
  const isMyTurn = !!myActiveHand
  const insuranceOffered =
    round?.phase === 'player_turns' && !!config?.allow_insurance && dealerUpcard?.rank === 'A'
  const hasBets = hands.some((h) => !h.is_dealer && h.bet_amount > 0)

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '실패')
    } finally {
      setBusy(null)
    }
  }

  if (room?.status === 'settled' && settlement) {
    return (
      <div className="min-h-dvh">
        <SettlementScreen settlement={settlement} />
      </div>
    )
  }

  // Build all seat slots (occupied + empty) for a full, centered table.
  const slots = Array.from({ length: maxSeats }, (_, i) => playerSeats.find((s) => s.seat_index === i) ?? null)
  const canJoin = !mySeat && room?.status !== 'closed'

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        roomName={room?.name ?? '...'}
        code={room?.code ?? ''}
        connected={connected}
        playerCount={playerSeats.length}
        maxSeats={maxSeats}
      />

      <main className="felt-table relative flex flex-1 flex-col justify-center gap-6 overflow-hidden border-y-2 border-gold/15 p-3 sm:justify-between sm:gap-0 sm:p-6">
        <FloatingSuits />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 [background:radial-gradient(50%_100%_at_50%_0%,color-mix(in_oklch,var(--gold)_12%,transparent),transparent)]" />

        {/* Dealer */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          <DealerArea dealerHand={dealerHand} phase={round?.phase ?? null} />
          {dealerSeat && (
            <span className="text-xs text-muted-foreground">
              뱅크 · {dealerSeat.display_name} · {formatChips(dealerSeat.chip_stack)}
            </span>
          )}
        </div>

        {/* Center stage fills the middle (desktop) / clusters (mobile) */}
        <div className="relative z-10 flex items-center justify-center py-2 sm:flex-1">
          <CenterStage
            status={room?.status ?? null}
            phase={round?.phase ?? null}
            secondsLeft={secondsLeft}
            activePlayerName={activeSeat?.display_name ?? null}
            isMyTurn={isMyTurn}
          />
        </div>

        {/* Players — a single centered row that scrolls horizontally on small
            screens instead of wrapping into a tall, empty stack. */}
        <div className="relative z-10 -mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          <div className="mx-auto flex w-max items-end gap-2 sm:gap-4">
            {slots.map((s, i) => (
              <SeatPod
                key={s?.id ?? `empty-${i}`}
                seat={s}
                hands={s ? hands.filter((h) => h.seat_id === s.id && !h.is_dealer) : []}
                activeHandId={activeHandId}
                isMe={s?.id === mySeat?.id}
                present={s?.user_id ? present.includes(s.user_id) : false}
                canJoin={canJoin}
                onJoin={() => run('join', () => takeSeat({ roomId, seatIndex: i, startingChips: 1000 }))}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Contextual control dock */}
      <BottomDock>
        {/* Primary contextual control */}
        {!mySeat ? (
          <JoinCta roomId={roomId} disabled={busy !== null} />
        ) : round?.phase === 'player_turns' && myActiveHand && config ? (
          <ActionBar
            roundId={round.id}
            hand={myActiveHand}
            seat={mySeat}
            config={config}
            dealerUpcard={dealerUpcard}
            splitCount={myHands.length}
            insuranceOffered={!!insuranceOffered}
          />
        ) : round?.phase === 'betting' && !mySeat.is_dealer ? (
          <BetControls roundId={round.id} seat={mySeat} config={config!} currentBet={myBetHand?.bet_amount ?? 0} />
        ) : (
          <WaitingHint
            phase={round?.phase ?? null}
            status={room?.status ?? null}
            isMyTurn={isMyTurn}
            activeName={activeSeat?.display_name ?? null}
          />
        )}

        {/* Secondary rows: buy-in + host controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {mySeat && (
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => run('buyin', async () => { await buyIn(mySeat.id, 1000); toast.success('1,000 충전') })}>
              + 충전 (보유 {formatChips(mySeat.chip_stack)})
            </Button>
          )}
          {isHost && (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              <span className="text-xs font-bold uppercase tracking-widest text-gold">호스트</span>
              {(room?.status === 'lobby' || round?.phase === 'complete' || round?.phase == null) && (
                <Button size="sm" variant="gold" disabled={busy !== null} onClick={() => run('start', () => (round?.phase === 'complete' ? nextRound(roomId) : startRound(roomId)))}>
                  {round?.phase === 'complete' ? '다음 라운드' : '라운드 시작'}
                </Button>
              )}
              {round?.phase === 'betting' && (
                <Button size="sm" variant="primary" disabled={busy !== null || !hasBets} onClick={() => run('deal', () => deal(roomId))}>
                  딜 시작
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setPanelOpen(true)}>
                정산 / 재배분
              </Button>
            </>
          )}
        </div>
      </BottomDock>

      {panelOpen && <HostSettlementPanel roomId={roomId} seats={playerSeats} onClose={() => setPanelOpen(false)} />}
    </div>
  )
}

function Header({
  roomName,
  code,
  connected,
  playerCount,
  maxSeats,
}: {
  roomName: string
  code: string
  connected: boolean
  playerCount: number
  maxSeats: number
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← 나가기</a>
        <h1 className="text-base font-extrabold">{roomName}</h1>
      </div>
      <div className="flex items-center gap-2.5 text-sm">
        <span className="text-muted-foreground">👤 {playerCount}/{maxSeats}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(code); toast.success('초대 코드 복사됨: ' + code) }}
          className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-gold"
          title="클릭해서 초대 코드 복사"
        >
          {code}
        </button>
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-accent' : 'bg-muted-foreground/40'}`} title={connected ? '실시간 연결됨' : '연결 중...'} />
      </div>
    </header>
  )
}

function BottomDock({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-gold/20 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-3">{children}</div>
    </div>
  )
}

function WaitingHint({
  phase,
  status,
  isMyTurn,
  activeName,
}: {
  phase: string | null
  status: string | null
  isMyTurn: boolean
  activeName: string | null
}) {
  let msg = '대기 중…'
  if (status === 'lobby' || !phase) msg = '호스트가 라운드를 시작하기를 기다리는 중'
  else if (phase === 'betting') msg = '딜러는 베팅하지 않습니다 — 딜을 기다리세요'
  else if (phase === 'player_turns') msg = isMyTurn ? '' : `${activeName ?? '다른 플레이어'}의 차례를 기다리는 중`
  else if (phase === 'dealer_turn') msg = '딜러가 카드를 받는 중…'
  else if (phase === 'complete' || phase === 'settlement') msg = '라운드 종료 — 다음 라운드를 기다리는 중'
  if (!msg) return null
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
      {msg}
    </div>
  )
}

function JoinCta({ roomId, disabled }: { roomId: string; disabled: boolean }) {
  const [chips, setChips] = useState(1000)
  const [pending, setPending] = useState(false)
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2">
      <span className="text-sm text-muted-foreground">아직 관전 중이에요 — 참가해서 베팅하세요</span>
      <div className="flex w-full items-center gap-2">
        <Input type="number" value={chips} min={0} onChange={(e) => setChips(Number(e.target.value))} className="w-32" />
        <Button
          variant="gold"
          size="lg"
          className="flex-1"
          disabled={disabled || pending}
          onClick={async () => {
            setPending(true)
            try {
              await takeSeat({ roomId, startingChips: chips })
              toast.success('착석 완료!')
            } catch (e) {
              toast.error(e instanceof Error ? e.message : '착석 실패')
            } finally {
              setPending(false)
            }
          }}
        >
          {formatChips(chips)} 충전하고 앉기
        </Button>
      </div>
    </div>
  )
}
