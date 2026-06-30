// Pure-ish server engine: given a loaded RoundState, compute the RoundPatch for
// the next authoritative state. Uses the tested blackjack rules engine. No I/O
// here — the action layer loads state, calls these, and commits the patch.

import {
  Card,
  Rank,
  Suit,
  handTotal,
  isBlackjack,
  legalActions,
  playDealer,
  settleHand,
  settleInsurance,
  Action,
  HandView,
} from '@/lib/blackjack'
import { LoadedHand, RoundPatch, RoundState, rulesFromConfig } from './types'

const SEAT_GAP = 100

function toCards(hand: LoadedHand): Card[] {
  return [...hand.cards]
    .sort((a, b) => a.card_index - b.card_index)
    .map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))
}

/** A cursor over the secret shoe. */
function makeDrawer(state: RoundState) {
  let cursor = state.deckCursor
  return {
    draw(): Card {
      if (cursor >= state.deck.length) throw new Error('shoe exhausted')
      const c = state.deck[cursor++]
      return { rank: c.rank as Rank, suit: c.suit as Suit }
    },
    get cursor() {
      return cursor
    },
  }
}

/** Player hands (non-dealer) ordered by play order. */
function playerHandsInOrder(state: RoundState): LoadedHand[] {
  return state.hands
    .filter((h) => !h.is_dealer)
    .sort((a, b) => a.seat_order - b.seat_order)
}

function isPlayable(hand: LoadedHand): boolean {
  return hand.status === 'active'
}

/** Next playable hand id after the given one (or null if none remain). */
function nextPlayableHandId(
  hands: LoadedHand[],
  afterSeatOrder: number
): string | null {
  const next = hands
    .filter((h) => isPlayable(h) && h.seat_order > afterSeatOrder)
    .sort((a, b) => a.seat_order - b.seat_order)[0]
  return next ? next.id : null
}

function firstPlayableHandId(hands: LoadedHand[]): string | null {
  const first = hands.filter(isPlayable).sort((a, b) => a.seat_order - b.seat_order)[0]
  return first ? first.id : null
}

function deadline(seconds: number): string {
  // Server computes the wall-clock deadline; clients only render a countdown.
  return new Date(Date.now() + seconds * 1000).toISOString()
}

// ---------------------------------------------------------------------
// DEAL: betting -> player_turns. Two cards per betting hand, dealer up-card.
// The dealer hole card is returned separately to be stored server-only.
// ---------------------------------------------------------------------
export function computeDealPatch(
  state: RoundState,
  dealerHandId: string
): { patch: RoundPatch; holeCard: Card; newCursor: number } {
  const rules = rulesFromConfig(state.config)
  const drawer = makeDrawer(state)
  const bettingHands = state.hands
    .filter((h) => !h.is_dealer && h.bet_amount > 0)
    .sort((a, b) => a.seat_order - b.seat_order)

  const insertCards: RoundPatch['insert_cards'] = []
  const updateHands: RoundPatch['update_hands'] = []

  // First card to each player, then dealer up, then second to each player,
  // then dealer hole — standard dealing order.
  const playerCards: Record<string, Card[]> = {}
  for (const h of bettingHands) playerCards[h.id] = []

  for (const h of bettingHands) playerCards[h.id].push(drawer.draw())
  const dealerUp = drawer.draw()
  for (const h of bettingHands) playerCards[h.id].push(drawer.draw())
  const holeCard = drawer.draw()

  for (const h of bettingHands) {
    const cards = playerCards[h.id]
    cards.forEach((c, i) =>
      insertCards.push({ hand_id: h.id, card_index: i, rank: c.rank, suit: c.suit })
    )
    const natural = isBlackjack(cards)
    updateHands.push({
      id: h.id,
      status: natural ? 'blackjack' : 'active',
    })
  }

  // Dealer up-card only (hole stays secret).
  insertCards.push({ hand_id: dealerHandId, card_index: 0, rank: dealerUp.rank, suit: dealerUp.suit })

  const playableAfterDeal: LoadedHand[] = bettingHands
    .filter((h) => !isBlackjack(playerCards[h.id]))
    .map((h) => ({ ...h, status: 'active' }))

  const active = playableAfterDeal.sort((a, b) => a.seat_order - b.seat_order)[0]

  const patch: RoundPatch = {
    insert_cards: insertCards,
    update_hands: updateHands,
    deck_cursor: drawer.cursor,
    round: {
      phase: active ? 'player_turns' : 'dealer_turn',
      dealer_hand_id: dealerHandId,
      active_hand_id: active ? active.id : null,
      turn_deadline: active ? deadline(state.config.turn_timer_seconds) : null,
    },
  }

  return { patch, holeCard, newCursor: drawer.cursor }
}

// ---------------------------------------------------------------------
// PLAYER ACTION
// ---------------------------------------------------------------------
export interface ActionResult {
  patch: RoundPatch
  /** True when the round has advanced into the dealer turn. */
  enterDealer: boolean
}

export function computeActionPatch(
  state: RoundState,
  handId: string,
  action: Action,
  payload?: { insuranceBet?: number }
): ActionResult {
  const rules = rulesFromConfig(state.config)
  const drawer = makeDrawer(state)
  const hand = state.hands.find((h) => h.id === handId)
  if (!hand || hand.is_dealer) throw new Error('hand not found')

  const seat = state.seats.find((s) => s.id === hand.seat_id)
  if (!seat) throw new Error('seat not found')

  const cards = toCards(hand)
  const view: HandView = {
    cards,
    bet: hand.bet_amount,
    splitDepth: hand.split_depth,
    isDoubled: hand.is_doubled,
    fromSplit: hand.split_depth > 0,
    isSplitAces: hand.is_split_aces,
  }
  const dealerUp = dealerUpcard(state)
  const splitCount = state.hands.filter(
    (h) => h.seat_id === hand.seat_id && !h.is_dealer
  ).length

  const legal = legalActions(view, rules, {
    availableChips: seat.chip_stack,
    currentSplitCount: splitCount,
    dealerUpcard: dealerUp,
  })

  // Insurance is handled out-of-band (only on dealer Ace, first decision).
  if (action !== 'insurance' && !legal.includes(action)) {
    throw new Error(`illegal action: ${action}`)
  }

  const updateHands: RoundPatch['update_hands'] = []
  const insertHands: RoundPatch['insert_hands'] = []
  const insertCards: RoundPatch['insert_cards'] = []
  const ledger: RoundPatch['ledger'] = []

  let handTerminal = false

  switch (action) {
    case 'stand': {
      updateHands.push({ id: hand.id, status: 'stood' })
      handTerminal = true
      break
    }
    case 'hit': {
      const c = drawer.draw()
      insertCards.push({ hand_id: hand.id, card_index: cards.length, rank: c.rank, suit: c.suit })
      const total = handTotal([...cards, c])
      if (total.isBust) {
        updateHands.push({ id: hand.id, status: 'busted' })
        handTerminal = true
      } else if (total.best === 21) {
        updateHands.push({ id: hand.id, status: 'stood' })
        handTerminal = true
      }
      break
    }
    case 'double': {
      const c = drawer.draw()
      insertCards.push({ hand_id: hand.id, card_index: cards.length, rank: c.rank, suit: c.suit })
      ledger.push({
        seat_id: seat.id,
        round_id: state.round.id,
        hand_id: hand.id,
        type: 'bet',
        amount: -hand.bet_amount,
      })
      const total = handTotal([...cards, c])
      updateHands.push({
        id: hand.id,
        is_doubled: true,
        bet_amount: hand.bet_amount * 2,
        status: total.isBust ? 'busted' : 'stood',
      })
      handTerminal = true
      break
    }
    case 'surrender': {
      updateHands.push({ id: hand.id, status: 'surrendered', outcome: 'surrender' })
      handTerminal = true
      break
    }
    case 'split': {
      // Move the second card to a new hand, draw one fresh card to each.
      const newHandId = crypto.randomUUID()
      const isAces = cards[0].rank === 'A'
      ledger.push({
        seat_id: seat.id,
        round_id: state.round.id,
        hand_id: newHandId,
        type: 'bet',
        amount: -hand.bet_amount,
      })

      // New hand keeps the original's 2nd card as index 0.
      const moved = cards[1]
      const drawA = drawer.draw() // to original
      const drawB = drawer.draw() // to new hand

      insertHands.push({
        id: newHandId,
        round_id: state.round.id,
        seat_id: seat.id,
        is_dealer: false,
        parent_hand_id: hand.id,
        split_depth: hand.split_depth + 1,
        bet_amount: hand.bet_amount,
        is_split_aces: isAces,
        status: 'active',
        seat_order: hand.seat_order + splitCount, // keep within the seat's block
      })

      // Original hand: remove its 2nd card by rewriting? hand_cards are append-only;
      // instead we delete-and-reinsert is avoided — we model split as: original keeps
      // card_index 0, the moved card row is re-pointed by inserting fresh sequence.
      // Simpler + consistent: original hand's cards become [orig[0], drawA]; new hand
      // [moved, drawB]. We achieve this by inserting drawA on the original and the
      // moved+drawB on the new hand. The stale original index-1 card is updated below.
      insertCards.push({ hand_id: hand.id, card_index: 1, rank: drawA.rank, suit: drawA.suit })
      insertCards.push({ hand_id: newHandId, card_index: 0, rank: moved.rank, suit: moved.suit })
      insertCards.push({ hand_id: newHandId, card_index: 1, rank: drawB.rank, suit: drawB.suit })

      // NOTE: requires the action layer to first delete the original's old index-1 row.
      updateHands.push({
        id: hand.id,
        split_depth: hand.split_depth + 1,
        is_split_aces: isAces,
        status: isAces && rules.splitAcesOneCard ? 'stood' : 'active',
      })
      if (isAces && rules.splitAcesOneCard) {
        // Both split-ace hands take exactly one card and stand.
        updateHands.push({ id: newHandId, status: 'stood' })
        handTerminal = true
      }
      break
    }
    case 'insurance': {
      const amt = payload?.insuranceBet ?? Math.floor(hand.bet_amount / 2)
      ledger.push({
        seat_id: seat.id,
        round_id: state.round.id,
        hand_id: hand.id,
        type: 'insurance',
        amount: -amt,
      })
      updateHands.push({ id: hand.id, insurance_bet: amt })
      // Insurance does not end the turn.
      break
    }
  }

  // Build the post-action hand list to find the next playable hand.
  const projected: LoadedHand[] = playerHandsInOrder(state).map((h) => {
    if (h.id === hand.id && handTerminal) {
      const upd = updateHands.find((u) => u.id === h.id)
      return { ...h, status: (upd?.status as LoadedHand['status']) ?? h.status }
    }
    return h
  })
  // Include a freshly split hand as playable (unless split-ace auto-stand).
  for (const ins of insertHands) {
    projected.push({
      ...(ins as unknown as LoadedHand),
      cards: [],
      status: (ins.status as LoadedHand['status']) ?? 'active',
    })
  }

  const round: RoundPatch['round'] = {}
  let enterDealer = false

  if (action === 'insurance') {
    // Same hand keeps acting; no turn advance.
    round.active_hand_id = hand.id
    round.turn_deadline = deadline(state.config.turn_timer_seconds)
  } else if (handTerminal) {
    const next =
      nextPlayableHandId(projected, hand.seat_order) ??
      firstPlayableHandId(projected.filter((h) => h.seat_order <= hand.seat_order))
    if (next) {
      round.active_hand_id = next
      round.turn_deadline = deadline(state.config.turn_timer_seconds)
    } else {
      round.phase = 'dealer_turn'
      round.active_hand_id = null
      round.turn_deadline = null
      enterDealer = true
    }
  } else {
    // Same hand keeps acting (e.g. hit without bust).
    round.active_hand_id = hand.id
    round.turn_deadline = deadline(state.config.turn_timer_seconds)
  }

  const patch: RoundPatch = {
    update_hands: updateHands,
    insert_hands: insertHands.length ? insertHands : undefined,
    insert_cards: insertCards.length ? insertCards : undefined,
    ledger: ledger.length ? ledger : undefined,
    deck_cursor: drawer.cursor,
    round,
  }

  return { patch, enterDealer }
}

// ---------------------------------------------------------------------
// DEALER TURN + SETTLEMENT
// AI dealer: reveal + auto-play + settle in one step.
// Human dealer: reveal (start turn) → manual hit(s) → stand (settle).
// ---------------------------------------------------------------------

function dealerHole(state: RoundState): Card {
  if (!state.dealerHoleCard) throw new Error('hole card missing')
  return { rank: state.dealerHoleCard.rank as Rank, suit: state.dealerHoleCard.suit as Suit }
}

/** Settle every player hand against the dealer's FINAL cards. Shared by the AI
 *  auto-play and the human dealer's stand. Marks the round complete. */
function buildSettlement(
  state: RoundState,
  dealerHandId: string,
  dealerCards: Card[],
  insertCards: NonNullable<RoundPatch['insert_cards']>,
  deckCursor: number
): RoundPatch {
  const rules = rulesFromConfig(state.config)
  const dealerBJ = isBlackjack(dealerCards) // natural only (2 cards)
  const updateHands: RoundPatch['update_hands'] = []
  const ledger: RoundPatch['ledger'] = []
  let dealerNet = 0

  for (const h of state.hands.filter((x) => !x.is_dealer)) {
    const seatId = h.seat_id!
    const surrendered = h.status === 'surrendered'
    const playerCards = toCards(h)

    if (h.insurance_bet > 0) {
      const insReturn = settleInsurance(h.insurance_bet, dealerBJ)
      dealerNet += h.insurance_bet - insReturn
      if (insReturn > 0) {
        ledger.push({ seat_id: seatId, round_id: state.round.id, hand_id: h.id, type: 'insurance_payout', amount: insReturn })
      }
    }

    if (h.status === 'busted') {
      dealerNet += h.bet_amount
      updateHands.push({ id: h.id, status: 'settled', outcome: 'lose', payout: 0 })
      continue
    }

    const result = settleHand(
      { cards: playerCards, bet: h.bet_amount, splitDepth: h.split_depth, surrendered },
      { cards: dealerCards },
      rules
    )
    dealerNet += h.bet_amount - result.payout
    if (result.payout > 0) {
      ledger.push({ seat_id: seatId, round_id: state.round.id, hand_id: h.id, type: 'payout', amount: result.payout })
    }
    updateHands.push({ id: h.id, status: 'settled', outcome: result.outcome, payout: result.payout })
  }

  // Human dealer = the bank: their chips move by the table's net (zero-sum).
  if (state.room.dealer_seat_id && dealerNet !== 0) {
    ledger.push({ seat_id: state.room.dealer_seat_id, round_id: state.round.id, hand_id: dealerHandId, type: 'payout', amount: dealerNet })
  }

  const dealerTotal = handTotal(dealerCards)
  updateHands.push({ id: dealerHandId, status: dealerTotal.isBust ? 'busted' : 'stood' })

  return {
    insert_cards: insertCards.length ? insertCards : undefined,
    update_hands: updateHands,
    ledger: ledger.length ? ledger : undefined,
    deck_cursor: deckCursor,
    reveal_hole: true,
    round: { phase: 'complete', active_hand_id: null, turn_deadline: null },
  }
}

/** AI dealer: reveal hole, auto-play fixed rules, settle. */
export function computeDealerSettlePatch(state: RoundState, dealerHandId: string): { patch: RoundPatch } {
  const rules = rulesFromConfig(state.config)
  const drawer = makeDrawer(state)
  const dealerHand = state.hands.find((h) => h.id === dealerHandId)
  if (!dealerHand) throw new Error('dealer hand missing')
  const upCard = toCards(dealerHand)[0]
  const hole = dealerHole(state)

  const insertCards: NonNullable<RoundPatch['insert_cards']> = [
    { hand_id: dealerHandId, card_index: 1, rank: hole.rank, suit: hole.suit },
  ]

  const anyoneLive = state.hands.some((h) => !h.is_dealer && (h.status === 'stood' || h.status === 'blackjack'))
  let dealerCards: Card[] = [upCard, hole]
  if (anyoneLive) {
    const res = playDealer([upCard, hole], () => drawer.draw(), rules)
    dealerCards = res.cards
    for (let i = 2; i < dealerCards.length; i++) {
      insertCards.push({ hand_id: dealerHandId, card_index: i, rank: dealerCards[i].rank, suit: dealerCards[i].suit })
    }
  }
  return { patch: buildSettlement(state, dealerHandId, dealerCards, insertCards, drawer.cursor) }
}

export function dealerUpcard(state: RoundState): Card {
  const dealer = state.hands.find((h) => h.is_dealer)
  if (!dealer || dealer.cards.length === 0) {
    return { rank: '2', suit: 'S' } // placeholder pre-deal
  }
  const c = [...dealer.cards].sort((a, b) => a.card_index - b.card_index)[0]
  return { rank: c.rank as Rank, suit: c.suit as Suit }
}

export const SEAT_ORDER_GAP = SEAT_GAP
