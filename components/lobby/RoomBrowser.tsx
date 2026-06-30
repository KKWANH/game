'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Panel } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn, formatChips } from '@/lib/utils'
import { listOpenRooms, type OpenRoom } from '@/actions/social-actions'

export function RoomBrowser() {
  const router = useRouter()
  const [rooms, setRooms] = useState<OpenRoom[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setRooms(await listOpenRooms())
    } catch {
      setRooms([])
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 6000) // keep the list reasonably live
    return () => clearInterval(id)
  }, [load])

  return (
    <Panel className="w-full space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          열린 방{' '}
          {rooms && <span className="text-sm font-normal text-muted-foreground">({rooms.length})</span>}
        </h2>
        <button
          onClick={load}
          className={cn(
            'text-sm text-muted-foreground transition hover:text-gold',
            refreshing && 'animate-pulse'
          )}
          title="새로고침"
        >
          ↻ 새로고침
        </button>
      </div>

      {rooms === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : rooms.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          열린 방이 없습니다. 위에서 새 방을 만들어 보세요!
        </p>
      ) : (
        <div className="-mx-1 max-h-[22rem] space-y-2 overflow-y-auto px-1">
          <AnimatePresence initial={false}>
            {rooms.map((r) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{r.name}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                        r.status === 'lobby'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-gold/15 text-gold'
                      )}
                    >
                      {r.status === 'lobby' ? '대기중' : '게임중'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                    <span>👑 {r.hostName}</span>
                    <span>
                      👤 {r.humans}/{r.maxSeats}
                      {r.ais > 0 && <span className="text-neon-cyan"> · 🤖 {r.ais}</span>}
                    </span>
                    <span>{r.dealerType === 'human' ? '사람 딜러' : 'AI 딜러'}</span>
                    <span>
                      베팅 {formatChips(r.minBet)}–{formatChips(r.maxBet)}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={r.joined ? 'secondary' : 'primary'}
                  className="shrink-0"
                  onClick={() => router.push(`/rooms/${r.code}`)}
                >
                  {r.joined ? '돌아가기' : '입장'}
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Panel>
  )
}
