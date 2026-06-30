'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRoomRealtime } from '@/lib/realtime/use-room-realtime'
import { useTurnTimer } from '@/lib/realtime/use-turn-timer'
import { useRoomStore } from '@/store/room-store'
import { SeatPod } from '@/components/table/SeatPod'
import { DealerArea } from '@/components/table/DealerArea'
import { CenterStage } from '@/components/game/CenterStage'
import { ActionBar } from '@/components/game/ActionBar'
import { DealerActionBar } from '@/components/game/DealerActionBar'
import { BetControls } from '@/components/game/BetControls'
import { SettlementScreen } from '@/components/settlement/SettlementScreen'
import { HostSettlementPanel } from '@/components/game/HostSettlementPanel'
import { startRound, aiAct } from '@/actions/game-actions'
import { takeSeat, buyIn, addAiSeat, removeSeat } from '@/actions/room-actions'
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

  const secondsLeft = useTurnTimer(round?.id ?? null, roomId, round?.turn_deadline ?? null, round?.phase ?? null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [aiDiff, setAiDiff] = useState<'easy' | 'normal' | 'hard'>('normal')

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

  const activeSeat = seats.find((s) => hands.some((h) => h.id === activeHandId && h.seat_id === s.id))
  const isMyTurn = !!myActiveHand
  // Human dealer playing their own hand during the dealer turn.
  const isMyDealerTurn =
    !!mySeat?.is_dealer && round?.phase === 'dealer_turn' && !!dealerHand && activeHandId === dealerHand.id

  // ---- Sound effects on key transitions ----
  const myTurnNow = isMyTurn || isMyDealerTurn
  const prev = useRef({ phase: '', myTurn: false })
  useEffect(() => {
    const phase = round?.phase ?? ''
    if (phase === 'player_turns' && prev.current.phase !== 'player_turns') sound.deal()
    if (myTurnNow && !prev.current.myTurn) sound.turn()
    if (phase === 'complete' && prev.current.phase !== 'complete' && mySeat && !mySeat.is_dealer) {
      const mine = hands.filter((h) => h.seat_id === mySeat.id && !h.is_dealer)
      if (mine.some((h) => h.outcome === 'win' || h.outcome === 'blackjack')) sound.win()
      else if (mine.some((h) => h.outcome === 'lose')) sound.lose()
    }
    prev.current = { phase, myTurn: myTurnNow }
  }, [round?.phase, myTurnNow, hands, mySeat])

  useEffect(() => {
    const unlock = () => sound.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Drive an AI seat when it's its turn (betting or playing). Any client fires
  // it after a short "thinking" delay; the server is idempotent (version guard).
  useEffect(() => {
    const phase = round?.phase
    if (!round || (phase !== 'betting' && phase !== 'player_turns')) return
    const activeHand = hands.find((h) => h.id === round.active_hand_id)
    const activeSeatObj = seats.find((s) => s.id === activeHand?.seat_id)
    if (!activeSeatObj?.is_ai) return
    const id = setTimeout(() => aiAct(round.id).catch(() => {}), 900 + Math.floor(Math.random() * 500))
    return () => clearTimeout(id)
  }, [round, hands, seats])
  const insuranceOffered =
    round?.phase === 'player_turns' && !!config?.allow_insurance && dealerUpcard?.rank === 'A'

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

      <main className="flex flex-1 items-center justify-center overflow-hidden p-2 sm:p-5">
        <div className="wood-rim relative w-full max-w-4xl rounded-[2.2rem] p-2 sm:rounded-[3.5rem] sm:p-[14px]">
          <div className="felt-surface relative flex min-h-[58vh] flex-col items-center justify-between overflow-hidden rounded-[1.6rem] p-4 pb-7 sm:min-h-[60vh] sm:rounded-[3rem] sm:p-7 sm:pb-10">
            {/* Dealer */}
            <div className="relative z-10 flex flex-col items-center gap-1">
              <DealerArea dealerHand={dealerHand} phase={round?.phase ?? null} />
              {dealerSeat && (
                <span className="text-xs text-muted-foreground">
                  뱅크 · {dealerSeat.display_name} · {formatChips(dealerSeat.chip_stack)}
                </span>
              )}
            </div>

            {/* Center stage */}
            <div className="relative z-10 flex flex-1 items-center justify-center py-2">
              <CenterStage
                status={room?.status ?? null}
                phase={round?.phase ?? null}
                secondsLeft={secondsLeft}
                turnSeconds={config?.turn_timer_seconds ?? 30}
                activePlayerName={activeSeat?.display_name ?? null}
                isMyTurn={isMyTurn || isMyDealerTurn}
                resultNet={
                  round?.phase === 'complete' && mySeat && !mySeat.is_dealer && myHands.length
                    ? myHands.reduce((s, h) => s + ((h.payout ?? 0) - h.bet_amount), 0)
                    : null
                }
              />
            </div>

            {/* Players — arced along the bottom of the table; scrolls on small screens */}
            <div className="relative z-10 -mx-2 w-full overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="mx-auto flex w-max items-end gap-1 sm:gap-3">
                {slots.map((s, i) => {
                  const center = (maxSeats - 1) / 2
                  const d = center === 0 ? 0 : Math.abs(i - center) / center
                  const dip = (1 - d * d) * 9 // middle seats sit slightly lower → bottom arc
                  return (
                    <div key={s?.id ?? `empty-${i}`} style={{ transform: `translateY(${dip}px)` }}>
                      <SeatPod
                        seat={s}
                        hands={s ? hands.filter((h) => h.seat_id === s.id && !h.is_dealer) : []}
                        activeHandId={activeHandId}
                        isMe={s?.id === mySeat?.id}
                        cardSize={s && s.id === mySeat?.id ? 'md' : 'sm'}
                        present={s?.user_id ? present.includes(s.user_id) : !!s?.is_ai}
                        canJoin={canJoin}
                        canRemove={isHost && !!s?.is_ai}
                        onRemove={s ? () => run('rmai', () => removeSeat(roomId, s.id)) : undefined}
                        onJoin={() => run('join', () => takeSeat({ roomId, seatIndex: i, startingChips: 1000 }))}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Contextual control dock */}
      <BottomDock>
        {/* Primary contextual control */}
        {!mySeat ? (
          <JoinCta roomId={roomId} disabled={busy !== null} />
        ) : isMyDealerTurn && dealerHand && round ? (
          <DealerActionBar roundId={round.id} dealerHand={dealerHand} />
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
        ) : round?.phase === 'betting' && myActiveHand && !mySeat.is_dealer ? (
          <BetControls roundId={round.id} seat={mySeat} config={config!} />
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
              {(room?.status === 'lobby' ||
                (room?.status === 'active' && !round) ||
                (round?.phase === 'complete' && !round?.dealer_hand_id)) && (
                <Button size="sm" variant="gold" disabled={busy !== null} onClick={() => run('start', () => startRound(roomId))}>
                  게임 시작
                </Button>
              )}
              <button
                onClick={() => setAiDiff((d) => (d === 'easy' ? 'normal' : d === 'normal' ? 'hard' : 'easy'))}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-gold"
                title="AI 난이도"
              >
                {aiDiff === 'easy' ? '쉬움' : aiDiff === 'normal' ? '보통' : '어려움'}
              </button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null || playerSeats.length >= maxSeats}
                onClick={() => run('addai', () => addAiSeat(roomId, aiDiff))}
              >
                🤖 AI 추가
              </Button>
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
        <MuteButton />
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

function MuteButton() {
  const [muted, setMuted] = useState(false)
  useEffect(() => setMuted(sound.isMuted()), [])
  return (
    <button
      onClick={() => setMuted(sound.toggle())}
      className="text-base leading-none text-muted-foreground transition hover:text-gold"
      title={muted ? '소리 켜기' : '소리 끄기'}
      aria-label="sound toggle"
    >
      {muted ? '🔇' : '🔊'}
    </button>
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
  if (status === 'lobby' || !phase) msg = '호스트가 게임을 시작하기를 기다리는 중'
  else if (phase === 'betting') msg = `${activeName ?? '다른 플레이어'} 베팅 중 — 곧 차례가 와요`
  else if (phase === 'dealing') msg = '카드 분배 중…'
  else if (phase === 'player_turns') msg = isMyTurn ? '' : `${activeName ?? '다른 플레이어'}의 차례를 기다리는 중`
  else if (phase === 'dealer_turn') msg = '딜러가 카드를 받는 중…'
  else if (phase === 'complete' || phase === 'settlement') msg = '라운드 종료 — 다음 판 준비 중…'
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
