'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRoomRealtime } from '@/lib/realtime/use-room-realtime'
import { useTurnTimer } from '@/lib/realtime/use-turn-timer'
import { useRoomStore } from '@/store/room-store'
import { Seat } from '@/components/table/Seat'
import { DealerArea } from '@/components/table/DealerArea'
import { PhaseBanner } from '@/components/game/PhaseBanner'
import { ActionBar } from '@/components/game/ActionBar'
import { BetControls } from '@/components/game/BetControls'
import { SettlementScreen } from '@/components/settlement/SettlementScreen'
import { startRound, deal, nextRound } from '@/actions/game-actions'
import { takeSeat, buyIn, closeRoom } from '@/actions/room-actions'
import { HostSettlementPanel } from '@/components/game/HostSettlementPanel'
import { FloatingSuits } from '@/components/effects/FloatingSuits'
import { formatChips } from '@/lib/utils'
import type { Card, Rank, Suit } from '@/lib/blackjack'
import type { SeatRow } from '@/lib/supabase/types'

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

  const hands = handsWithCards()
  const dealerHand = hands.find((h) => h.is_dealer) ?? null
  const dealerUpcard: Card | null = dealerHand?.cards[0]
    ? { rank: dealerHand.cards[0].rank as Rank, suit: dealerHand.cards[0].suit as Suit }
    : null

  const isHost = room?.host_user_id === meId
  const activeHandId = round?.active_hand_id ?? null
  const playerSeats = seats.filter((s) => s.status !== 'left')

  const myHands = mySeat ? hands.filter((h) => h.seat_id === mySeat.id && !h.is_dealer) : []
  const myActiveHand = myHands.find((h) => h.id === activeHandId) ?? null
  const myBetHand = myHands[0] ?? null

  const insuranceOffered =
    round?.phase === 'player_turns' && !!config?.allow_insurance && dealerUpcard?.rank === 'A'

  if (room?.status === 'settled' && settlement) {
    return (
      <div className="min-h-dvh">
        <SettlementScreen settlement={settlement} />
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh">
      <Header
        roomName={room?.name ?? '...'}
        code={room?.code ?? ''}
        connected={connected}
        phaseBanner={
          <PhaseBanner
            phase={round?.phase ?? null}
            status={room?.status ?? null}
            secondsLeft={secondsLeft}
          />
        }
      />

      {/* Felt table */}
      <div className="felt-table relative mx-auto mt-2 min-h-[60vh] max-w-5xl overflow-hidden rounded-[2.5rem] border-4 border-gold/20 p-4 sm:p-8">
        <FloatingSuits />
        {/* Dealer spotlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 [background:radial-gradient(50%_100%_at_50%_0%,color-mix(in_oklch,var(--gold)_12%,transparent),transparent)]" />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <DealerArea dealerHand={dealerHand} phase={round?.phase ?? null} />

          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {playerSeats
              .filter((s) => !s.is_dealer)
              .map((s) => (
                <Seat
                  key={s.id}
                  seat={s}
                  hands={hands.filter((h) => h.seat_id === s.id && !h.is_dealer)}
                  activeHandId={activeHandId}
                  isMe={s.id === mySeat?.id}
                  present={s.user_id ? present.includes(s.user_id) : false}
                />
              ))}
          </div>
        </div>
      </div>

      {/* My controls */}
      <div className="mx-auto mt-4 flex max-w-5xl flex-col items-center gap-4 px-4 pb-28">
        {!mySeat && room?.status !== 'closed' && (
          <JoinPanel roomId={roomId} minChips={config?.min_bet ?? 10} />
        )}

        {mySeat && !mySeat.is_dealer && round?.phase === 'betting' && (
          <BetControls
            roundId={round.id}
            seat={mySeat}
            config={config!}
            currentBet={myBetHand?.bet_amount ?? 0}
          />
        )}

        {mySeat && myActiveHand && round?.phase === 'player_turns' && config && (
          <ActionBar
            roundId={round.id}
            hand={myActiveHand}
            seat={mySeat}
            config={config}
            dealerUpcard={dealerUpcard}
            splitCount={myHands.length}
            insuranceOffered={!!insuranceOffered}
          />
        )}

        {mySeat && <BuyInButton seatId={mySeat.id} stack={mySeat.chip_stack} />}
      </div>

      {/* Host controls dock */}
      {isHost && (
        <HostDock
          roomId={roomId}
          seats={playerSeats}
          status={room?.status ?? 'lobby'}
          phase={round?.phase ?? null}
          hasBets={hands.some((h) => !h.is_dealer && h.bet_amount > 0)}
        />
      )}
    </div>
  )
}

function Header({
  roomName,
  code,
  connected,
  phaseBanner,
}: {
  roomName: string
  code: string
  connected: boolean
  phaseBanner: React.ReactNode
}) {
  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-extrabold">{roomName}</h1>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code)
            toast.success('초대 코드 복사됨: ' + code)
          }}
          className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-mono font-bold tracking-widest text-gold"
        >
          {code}
        </button>
      </div>
      <div className="flex items-center gap-3">
        {phaseBanner}
        <span
          className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-accent' : 'bg-muted-foreground/40'}`}
          title={connected ? '연결됨' : '연결 중...'}
        />
      </div>
    </header>
  )
}

function JoinPanel({ roomId, minChips }: { roomId: string; minChips: number }) {
  const [chips, setChips] = useState(1000)
  const [pending, setPending] = useState(false)
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/80 p-4">
      <span className="text-sm text-muted-foreground">이 방에 참가하기</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={chips}
          min={0}
          onChange={(e) => setChips(Number(e.target.value))}
          className="w-32"
        />
        <Button
          variant="gold"
          disabled={pending}
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
          {formatChips(chips)} 충전하고 착석
        </Button>
      </div>
    </div>
  )
}

function BuyInButton({ seatId, stack }: { seatId: string; stack: number }) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        try {
          await buyIn(seatId, 1000)
          toast.success('1,000 충전')
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '충전 실패')
        } finally {
          setPending(false)
        }
      }}
    >
      + 충전 (현재 {formatChips(stack)})
    </Button>
  )
}

function HostDock({
  roomId,
  seats,
  status,
  phase,
  hasBets,
}: {
  roomId: string
  seats: SeatRow[]
  status: string
  phase: string | null
  hasBets: boolean
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setPending(key)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '실패')
    } finally {
      setPending(null)
    }
  }

  const canStart = status === 'lobby' || phase === 'complete' || phase == null
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gold/20 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 px-4 py-3">
        <span className="mr-2 text-xs font-bold uppercase tracking-widest text-gold">호스트</span>
        {canStart && (
          <Button variant="gold" disabled={pending !== null} onClick={() => run('start', () => startRound(roomId))}>
            {phase === 'complete' ? '다음 라운드' : '라운드 시작'}
          </Button>
        )}
        {phase === 'betting' && (
          <Button
            variant="primary"
            disabled={pending !== null || !hasBets}
            onClick={() => run('deal', () => deal(roomId))}
          >
            딜 시작
          </Button>
        )}
        <Button variant="secondary" disabled={pending !== null} onClick={() => setPanelOpen(true)}>
          정산 / 재배분
        </Button>
      </div>
      {panelOpen && (
        <HostSettlementPanel roomId={roomId} seats={seats} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  )
}
