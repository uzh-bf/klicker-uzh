import { describe, expect, test } from 'vitest'
import {
  CARD_TITLE_SIMILARITY_THRESHOLD,
  cardTitleSimilarity,
  discardPotentialDuplicateCards,
  findPotentialDuplicateTitle,
} from '../src/lib/server/personalElements/titleSimilarity'

describe('personal-element title duplicate checks', () => {
  test('treats normalized exact titles as duplicates', () => {
    expect(cardTitleSimilarity('CAPM: Definition', 'capm definition')).toBe(1)
    expect(
      cardTitleSimilarity('Ökonomische Übersicht!', 'okonomische ubersicht')
    ).toBe(1)
    expect(
      findPotentialDuplicateTitle('CAPM: Definition', ['CAPM definition'])
    ).toMatchObject({ matchedTitle: 'CAPM definition', similarity: 1 })
  })

  test('catches close spelling variants without suppressing a different topic', () => {
    expect(
      findPotentialDuplicateTitle('Inflation drivers', ['Inflation driver'])
        ?.similarity
    ).toBeGreaterThanOrEqual(CARD_TITLE_SIMILARITY_THRESHOLD)
    expect(
      findPotentialDuplicateTitle('Capital Asset Pricing Model', [
        'Capital Asset Allocation Model',
      ])
    ).toBeNull()
  })

  test('treats multi-word title expansions as potential duplicates', () => {
    const match = findPotentialDuplicateTitle(
      'Capital Asset Pricing Model Definition and Formula',
      ['Capital Asset Pricing Model Definition']
    )

    expect(match?.similarity).toBeGreaterThanOrEqual(
      CARD_TITLE_SIMILARITY_THRESHOLD
    )
  })

  test('treats a pure acronym and its expanded title as potential duplicates', () => {
    expect(
      cardTitleSimilarity('CAPM', 'Capital Asset Pricing Model')
    ).toBeGreaterThanOrEqual(CARD_TITLE_SIMILARITY_THRESHOLD)
  })

  test('keeps clearly different titles and reports filtered cards', () => {
    const result = discardPotentialDuplicateCards(
      [
        {
          type: 'FLASHCARD',
          title: 'CAPM Definition',
          intent: 'define',
          query: 'capm',
        },
        {
          type: 'FLASHCARD',
          title: 'Inflation drivers',
          intent: 'explain',
          query: 'inflation',
        },
        {
          type: 'FLASHCARD',
          title: 'Inflation Drivers',
          intent: 'formula',
          query: 'inflation',
        },
      ],
      ['Capital Asset Pricing Model Definition']
    )

    expect(result.retained.map((card) => card.title)).toEqual([
      'Inflation drivers',
    ])
    expect(result.discardedDuplicates).toEqual([
      expect.objectContaining({
        title: 'CAPM Definition',
        matchedTitle: 'Capital Asset Pricing Model Definition',
      }),
      expect.objectContaining({
        title: 'Inflation Drivers',
        matchedTitle: 'Inflation drivers',
      }),
    ])
  })

  test('reports when every proposed title is discarded', () => {
    const result = discardPotentialDuplicateCards(
      [
        {
          type: 'FLASHCARD',
          title: 'CAPM Definition',
          intent: 'Define',
          query: 'CAPM',
        },
        {
          type: 'FLASHCARD',
          title: 'CAPM Definition!',
          intent: 'Explain',
          query: 'CAPM',
        },
      ],
      ['CAPM Definition']
    )

    expect(result.retained).toEqual([])
    expect(result.discardedDuplicates).toHaveLength(2)
  })
})
