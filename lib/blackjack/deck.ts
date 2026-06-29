import { Card, RANKS, SUITS } from './cards'

export type Rng = () => number

/** Build an ordered single deck (52 cards). */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

/** Build a shoe of `numDecks` decks, unshuffled. */
export function createShoe(numDecks: number): Card[] {
  if (numDecks < 1 || !Number.isInteger(numDecks)) {
    throw new Error(`numDecks must be a positive integer, got ${numDecks}`)
  }
  const shoe: Card[] = []
  for (let i = 0; i < numDecks; i++) {
    shoe.push(...createDeck())
  }
  return shoe
}

/**
 * Fisher-Yates shuffle with an injectable RNG.
 * Returns a NEW array; does not mutate the input.
 * On the server, pass a crypto-backed rng; in tests, a seeded one.
 */
export function shuffle(cards: Card[], rng: Rng): Card[] {
  const out = cards.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Convenience: create + shuffle a shoe. */
export function createShuffledShoe(numDecks: number, rng: Rng): Card[] {
  return shuffle(createShoe(numDecks), rng)
}

/**
 * A simple deterministic RNG (mulberry32) for tests / reproducible shuffles.
 * NOT cryptographically secure — never use for real dealing on the server.
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
