import { describe, expect, it } from 'vitest'
import type { WorkbookElement } from '../src/scripts/elementWorkbook/parse.js'
import {
  comparisonCsv,
  digest,
  elementIdentity,
  planImport,
} from '../src/scripts/elementWorkbook/plan.js'

const card: WorkbookElement = {
  sheet: 'Flashcards',
  row: 8,
  name: 'Card',
  content: 'Front',
  explanation: 'Back',
  type: 'FLASHCARD',
  basePoints: false,
  pointsMultiplier: 1,
  options: {},
  tags: ['Topic'],
}

describe('element workbook planning', () => {
  it('skips library and workbook duplicates without changing tags or titles', () => {
    const second = { ...card, row: 9, name: 'Other title', tags: ['Other tag'] }
    expect(planImport([card, second], []).map((d) => d.action)).toEqual([
      'CREATE',
      'SKIP_WORKBOOK',
    ])
    const existing = [{ id: 12, identity: elementIdentity(card) }]
    expect(planImport([second], existing)).toEqual([
      expect.objectContaining({
        action: 'SKIP_EXISTING',
        existingId: 12,
        row: 9,
        name: 'Other title',
      }),
    ])
    expect(
      planImport([{ ...card, explanation: 'Different back' }], existing)[0]
        ?.action
    ).toBe('CREATE')
  })

  it('compares ordered MC answers, correctness, feedback, explanation and scoring', () => {
    const mc: WorkbookElement = {
      ...card,
      type: 'MC',
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          { ix: 0, value: 'A', correct: true, feedback: 'Why' },
          { ix: 1, value: 'B', correct: false, feedback: '-' },
        ],
      },
    }
    const identity = elementIdentity(mc)
    const options = mc.options as {
      choices: {
        ix: number
        value: string
        correct: boolean
        feedback: string
      }[]
    }
    expect(
      elementIdentity({
        ...mc,
        options: {
          ...mc.options,
          choices: [...options.choices]
            .reverse()
            .map((c) => ({ ...c, id: 123 })),
        },
      })
    ).toBe(identity)
    for (const changed of [
      { ...mc, content: 'Different question' },
      { ...mc, pointsMultiplier: 2 },
      {
        ...mc,
        options: {
          ...mc.options,
          choices: [
            { ...options.choices[0], feedback: 'Changed' },
            options.choices[1],
          ],
        },
      },
      {
        ...mc,
        options: {
          ...mc.options,
          choices: options.choices.map((c) => ({ ...c, ix: 1 - c.ix })),
        },
      },
    ])
      expect(elementIdentity(changed)).not.toBe(identity)
  })

  it('hashes state deterministically and protects comparison CSV formula cells', () => {
    expect(digest({ a: 1, b: 2 })).toBe(digest({ b: 2, a: 1 }))
    const csv = comparisonCsv(
      planImport([{ ...card, name: '=HYPERLINK("example")' }], [])
    )
    expect(csv).toContain('"\'=HYPERLINK(""example"")"')
    expect(csv).toContain('"CREATE"')
  })
})
