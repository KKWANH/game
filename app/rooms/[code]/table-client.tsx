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
import { BetControls } from '@/components/game/BetControls'
import { SettlementScreen } from '@/components/settlement/SettlementScreen'
import { HostSettlementPanel } from '@/components/game/HostSettlementPanel'
import { RoomSettingsPanel } from '@/components/game/RoomSettingsPanel'
import { startRound, aiAct } from '@/actions/game-actions'
import { takeSeat, buyIn, addAiSeat, removeSeat, leaveSeat } from '@/actions/room-actions'
import { formatChips } from '@/lib/utils'
import { formatMoney, DEFAULT_MONEY, type MoneyConfig } from '@/lib/money'
import type { Card, Rank, Suit } from '@/lib/blackjack'
import type { SettlementRow } from '@/lib/supabase/types'

export function TableClient({ roomId, meId }: { roomId: string; meId: string }) {
  useRoomRealtime(roomId, meId)
  const room = useRoomStore((s) => s.room)
  const config = useRoomStore((s) => s.config)
  const seats = useRoomStore((s) => s.seats)
  const round = useRoomStore((s) => s.round)
  const settlement = useRoomStore((s) => s.settlement)
  const interim = useRoomStore((s) => s.interimSettlement)
  const present = useRoomStore((s) => s.presentUserIds)
  const connected = useRoomStore((s) => s.connected)
  const handsWithCards = useRoomStore((s) => s.handsWithCards)
  const mySeat = useRoomStore((s) => s.mySeat)()

  const secondsLeft = useTurnTimer(round?.id ?? null, roomId, round?.turn_deadline ?? null, round?.phase ?? null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  // Simultaneous betting: my still-open betting hand (null once I've bet/passed).
  const myBettingHand = myHands.find((h) => h.status === 'betting' && h.bet_amount === 0) ?? null
  // How many seats are still deciding their bet (for the "waiting" hint).
  const bettingPending = hands.filter((h) => !h.is_dealer && h.status === 'betting' && h.bet_amount === 0).length

  const activeSeat = seats.find((s) => hands.some((h) => h.id === activeHandId && h.seat_id === s.id))
  const isMyTurn = !!myActiveHand

  // ---- Sound effects on key transitions ----
  const myTurnNow = isMyTurn
  const prev = useRef({ phase: '', myTurn: false, cards: 0, busts: 0, init: false })
  useEffect(() => {
    const phase = round?.phase ?? ''
    // Per-action feedback: a blip every time a card lands (deal + each hit) and
    // a "womp" the moment any hand busts. Skip the very first run so joining
    // mid-round doesn't replay everything already on the felt.
    const cardCount = hands.reduce((n, h) => n + h.cards.length, 0)
    const bustCount = hands.filter((h) => h.status === 'busted').length
    if (prev.current.init) {
      if (cardCount > prev.current.cards) sound.card()
      if (bustCount > prev.current.busts) sound.bust()
      if (myTurnNow && !prev.current.myTurn) sound.turn()
      if (phase === 'complete' && prev.current.phase !== 'complete' && mySeat && !mySeat.is_dealer) {
        const mine = hands.filter((h) => h.seat_id === mySeat.id && !h.is_dealer)
        if (mine.some((h) => h.outcome === 'win' || h.outcome === 'blackjack')) sound.win()
        else if (mine.some((h) => h.outcome === 'lose')) sound.lose()
      }
    }
    prev.current = { phase, myTurn: myTurnNow, cards: cardCount, busts: bustCount, init: true }
  }, [round?.phase, myTurnNow, hands, mySeat])

  useEffect(() => {
    const unlock = () => sound.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Best-effort free-my-seat on tab close so abandoned rooms don't linger as open.
  const mySeatId = mySeat?.id
  useEffect(() => {
    if (!mySeatId) return
    const onHide = () => {
      try {
        navigator.sendBeacon('/api/leave', new Blob([JSON.stringify({ seatId: mySeatId })], { type: 'application/json' }))
      } catch {
        // ignore
      }
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [mySeatId])

  // Drive AI seats. During (simultaneous) betting, fire whenever any AI hand
  // hasn't bet yet; during player turns, fire when the active hand is an AI's.
  // Any client may fire it; the server is idempotent (version guard).
  useEffect(() => {
    const phase = round?.phase
    if (!round) return
    let aiPending = false
    if (phase === 'betting') {
      aiPending = hands.some(
        (h) => !h.is_dealer && h.status === 'betting' && h.bet_amount === 0 && seats.find((s) => s.id === h.seat_id)?.is_ai
      )
    } else if (phase === 'player_turns') {
      const activeHand = hands.find((h) => h.id === round.active_hand_id)
      aiPending = !!seats.find((s) => s.id === activeHand?.seat_id)?.is_ai
    }
    if (!aiPending) return
    const id = setTimeout(() => aiAct(round.id).catch(() => {}), 350 + Math.floor(Math.random() * 250))
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
        onLeave={async () => {
          if (mySeat) await leaveSeat(mySeat.id).catch(() => {})
          window.location.href = '/'
        }}
      />

      {interim && <InterimBanner settlement={interim} mySeatId={mySeat?.id ?? null} />}

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
                isMyTurn={isMyTurn}
                myBetOpen={!!myBettingHand}
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
        ) : round?.phase === 'betting' && myBettingHand && !mySeat.is_dealer ? (
          <BetControls roundId={round.id} seat={mySeat} config={config!} />
        ) : round?.phase === 'betting' && !mySeat.is_dealer ? (
          <p className="text-sm text-muted-foreground">
            ✓ 베팅 완료 · 다른 플레이어 {bettingPending}명 대기 중…
          </p>
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
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setSettingsOpen(true)}>
                ⚙ 방 설정
              </Button>
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setPanelOpen(true)}>
                정산 / 재배분
              </Button>
            </>
          )}
        </div>
      </BottomDock>

      {panelOpen && <HostSettlementPanel roomId={roomId} seats={playerSeats} onClose={() => setPanelOpen(false)} />}
      {settingsOpen && room && config && (
        <RoomSettingsPanel room={room} config={config} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}

function Header({
  roomName,
  code,
  connected,
  playerCount,
  maxSeats,
  onLeave,
}: {
  roomName: string
  code: string
  connected: boolean
  playerCount: number
  maxSeats: number
  onLeave?: () => void
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <button onClick={onLeave} className="text-sm text-muted-foreground hover:text-foreground">← 나가기</button>
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

/** Persistent bar shown to everyone after the host records a 중간정산. */
function InterimBanner({ settlement, mySeatId }: { settlement: SettlementRow; mySeatId: string | null }) {
  const money: MoneyConfig =
    settlement.currency != null
      ? { currency: settlement.currency, unitChips: settlement.unit_chips ?? 1, unitAmount: settlement.unit_amount ?? 1 }
      : settlement.chip_value_krw && settlement.chip_value_krw > 0
        ? { currency: 'KRW', unitChips: 1, unitAmount: settlement.chip_value_krw }
        : DEFAULT_MONEY
  const mine = settlement.net_by_seat.find((n) => n.seatId === mySeatId)
  const time = (() => {
    try {
      return new Date(settlement.computed_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  })()
  const owe = settlement.transfers
    .filter((t) => t.fromSeat === mySeatId)
    .map((t) => settlement.net_by_seat.find((n) => n.seatId === t.toSeat)?.displayName)
  const owed = settlement.transfers
    .filter((t) => t.toSeat === mySeatId)
    .map((t) => settlement.net_by_seat.find((n) => n.seatId === t.fromSeat)?.displayName)
  const amount = (chips: number) => formatMoney(chips, money)

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-y border-gold/30 bg-gold/10 px-4 py-1.5 text-center text-xs">
      <span className="font-bold text-gold">💰 중간정산 완료{time && ` · ${time}`}</span>
      {mine && (
        <span className={mine.net > 0 ? 'text-accent' : mine.net < 0 ? 'text-destructive' : 'text-muted-foreground'}>
          나: {mine.net > 0 ? '+' : ''}
          {amount(mine.net)}
        </span>
      )}
      {owe.length > 0 && (
        <span className="text-destructive">→ {owe.join(', ')}에게 보낼 것</span>
      )}
      {owed.length > 0 && (
        <span className="text-accent">← {owed.join(', ')}에게 받을 것</span>
      )}
    </div>
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
