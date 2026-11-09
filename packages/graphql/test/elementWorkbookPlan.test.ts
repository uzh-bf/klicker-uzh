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
  it('includes every type-specific option in duplicate identity', () => {
    const numerical: WorkbookElement = {
      ...card,
      type: 'NUMERICAL',
      basePoints: true,
      options: {
        hasSampleSolution: true,
        exactSolutions: [42],
        accuracy: 2,
        unit: 'm',
        placeholder: 'Distance',
        restrictions: { min: 0, max: 100 },
      },
    }
    const text: WorkbookElement = {
      ...card,
      type: 'FREE_TEXT',
      basePoints: true,
      options: {
        hasSampleSolution: true,
        solutions: ['red', 'blue'],
        restrictions: { maxLength: 10 },
      },
    }
    const numericalIdentity = elementIdentity(numerical)
    for (const changed of [
      { exactSolutions: [43] },
      { accuracy: 3 },
      { unit: 'cm' },
      { placeholder: 'Length' },
      { restrictions: { min: 1, max: 100 } },
      { exactSolutions: [], solutionRanges: [{ min: 40, max: 44 }] },
    ])
      expect(
        elementIdentity({
          ...numerical,
          options: { ...numerical.options, ...changed },
        })
      ).not.toBe(numericalIdentity)
    expect(
      elementIdentity({
        ...text,
        options: { ...text.options, solutions: ['blue', 'red'] },
      })
    ).toBe(elementIdentity(text))
    expect(
      elementIdentity({
        ...text,
        options: { ...text.options, solutions: ['green'] },
      })
    ).not.toBe(elementIdentity(text))
    expect(
      elementIdentity({
        ...text,
        options: { ...text.options, restrictions: { maxLength: 20 } },
      })
    ).not.toBe(elementIdentity(text))
    expect(elementIdentity({ ...card, type: 'CONTENT' })).not.toBe(
      elementIdentity(card)
    )
    for (const type of ['SC', 'KPRIM'] as const) {
      const choice = {
        ...card,
        type,
        options: {
          hasSampleSolution: true,
          choices: [{ ix: 0, value: 'A', correct: true }],
        },
      }
      expect(
        elementIdentity({
          ...choice,
          options: {
            ...choice.options,
            choices: [{ ix: 0, value: 'B', correct: true }],
          },
        })
      ).not.toBe(elementIdentity(choice))
      expect(
        elementIdentity({
          ...choice,
          options: {
            ...choice.options,
            choices: [{ ix: 0, value: 'A', correct: false }],
          },
        })
      ).not.toBe(elementIdentity(choice))
    }
  })

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
