import { describe, it, expect } from 'vitest'
import { createShoe, createDeck, shuffle, seededRng, createShuffledShoe } from '../deck'
import { cardToString } from '../cards'

describe('deck/shoe', () => {
  it('single deck has 52 unique cards', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    const set = new Set(deck.map(cardToString))
    expect(set.size).toBe(52)
  })

  it('shoe of N decks has 52*N cards', () => {
    expect(createShoe(6)).toHaveLength(312)
  })

  it('rejects invalid deck counts', () => {
    expect(() => createShoe(0)).toThrow()
    expect(() => createShoe(1.5)).toThrow()
  })

  it('shuffle preserves multiset and does not mutate input', () => {
    const original = createShoe(1)
    const snapshot = original.map(cardToString)
    const shuffled = shuffle(original, seededRng(42))
    expect(original.map(cardToString)).toEqual(snapshot) // unmutated
    const a = [...shuffled.map(cardToString)].sort()
    const b = [...snapshot].sort()
    expect(a).toEqual(b)
  })

  it('seeded shuffle is deterministic', () => {
    const one = createShuffledShoe(2, seededRng(7)).map(cardToString)
    const two = createShuffledShoe(2, seededRng(7)).map(cardToString)
    expect(one).toEqual(two)
  })

  it('different seeds usually differ', () => {
    const one = createShuffledShoe(1, seededRng(1)).map(cardToString).join('')
    const two = createShuffledShoe(1, seededRng(2)).map(cardToString).join('')
    expect(one).not.toEqual(two)
  })
})
