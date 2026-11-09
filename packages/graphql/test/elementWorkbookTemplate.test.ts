import { describe, expect, it } from 'vitest'
import {
  type ExportableElement,
  exportElementWorkbook,
  formatWorkbookTags,
} from '../src/lib/elementWorkbook/export.js'
import {
  ELEMENT_WORKBOOK_HEADERS,
  parseElementWorkbook,
} from '../src/lib/elementWorkbook/parse.js'
import { elementIdentity } from '../src/lib/elementWorkbook/plan.js'
import {
  createTemplateExamples,
  writeElementWorkbook,
} from '../src/lib/elementWorkbook/template.js'
import {
  ELEMENT_WORKBOOK_FIELDS,
  type ElementWorkbookSheet,
  emptyTemplateRows,
  templateColumnLabel,
} from '../src/lib/elementWorkbook/templateFields.js'

const base = {
  explanation: null,
  basePoints: true,
  pointsMultiplier: 1,
  tags: [],
}

const elements: ExportableElement[] = [
  {
    ...base,
    id: 1,
    type: 'SC',
    name: 'Capital',
    content: 'Which city is the **capital**?\n\nPick one.',
    explanation: 'Bern is the federal city.',
    pointsMultiplier: 2,
    tags: ['Geography', 'Week; 1'],
    options: {
      displayMode: 'GRID',
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      choices: [
        { ix: 1, value: 'Zurich', correct: false, feedback: 'No.' },
        { ix: 0, value: 'Bern', correct: true, feedback: 'Yes.' },
      ],
    },
  },
  {
    ...base,
    id: 2,
    type: 'KPRIM',
    name: 'Statements',
    content: 'True or false?',
    options: {
      displayMode: 'LIST',
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      choices: ['A', 'B', 'C', 'D'].map((value, ix) => ({ ix, value })),
    },
  },
  {
    ...base,
    id: 3,
    type: 'NUMERICAL',
    name: 'Range',
    content: 'Estimate pi.',
    basePoints: false,
    options: {
      hasSampleSolution: true,
      unit: 'units',
      accuracy: 2,
      placeholder: 'e.g. 3',
      restrictions: { min: 0, max: 10 },
      solutionRanges: [{ min: 3.1, max: 3.2 }, { min: 3 }],
    },
  },
  {
    ...base,
    id: 4,
    type: 'FREE_TEXT',
    name: 'Planet',
    content: 'Largest planet?',
    options: {
      hasSampleSolution: true,
      restrictions: { maxLength: 20 },
      solutions: ['Jupiter', 'jupiter'],
    },
  },
  {
    ...base,
    id: 5,
    type: 'FLASHCARD',
    name: 'Card',
    content: 'Front',
    explanation: 'Back',
    // Unscored types keep their stored scoring fields; identity ignores them.
    pointsMultiplier: 3,
    options: {},
  },
  {
    ...base,
    id: 6,
    type: 'CONTENT',
    name: 'Info',
    content: 'Read me.',
    options: {},
  },
  {
    ...base,
    id: 7,
    type: 'CASE_STUDY',
    name: 'Case',
    content: 'x',
    options: {},
  },
  {
    ...base,
    id: 8,
    type: 'MC',
    name: 'Too many',
    content: 'Pick',
    options: {
      displayMode: 'LIST',
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      choices: Array.from({ length: 11 }, (_, ix) => ({ ix, value: `${ix}` })),
    },
  },
  {
    ...base,
    id: 9,
    type: 'SC',
    name: 'Missing feedback',
    content: 'Pick',
    options: {
      displayMode: 'LIST',
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      choices: [{ ix: 0, value: 'Only', correct: true }],
    },
  },
]

describe('element workbook template', () => {
  it('labels every column exactly as the parser expects', () => {
    for (const sheet of Object.keys(
      ELEMENT_WORKBOOK_HEADERS
    ) as ElementWorkbookSheet[]) {
      expect(
        ELEMENT_WORKBOOK_FIELDS[sheet].map((field) =>
          templateColumnLabel(sheet, field)
        )
      ).toEqual([...ELEMENT_WORKBOOK_HEADERS[sheet]])
      expect(ELEMENT_WORKBOOK_FIELDS[sheet]).toHaveLength(
        ELEMENT_WORKBOOK_HEADERS[sheet].length
      )
    }
  })

  it('accepts the generated template with and without its examples', async () => {
    const examples = await parseElementWorkbook(
      await writeElementWorkbook(createTemplateExamples())
    )
    expect(examples.map((element) => element.type)).toEqual([
      'SC',
      'MC',
      'KPRIM',
      'NUMERICAL',
      'FREE_TEXT',
      'CONTENT',
      'FLASHCARD',
    ])
    expect(examples.every((e) => e.tags.join() === 'Examples')).toBe(true)
    expect(
      await parseElementWorkbook(
        await writeElementWorkbook(emptyTemplateRows())
      )
    ).toEqual([])
  })
})

describe('exportElementWorkbook', () => {
  it('quotes tags the importer would split', () => {
    expect(formatWorkbookTags(['A', 'B; C', 'say "hi"'])).toBe(
      'A; "B; C"; "say ""hi"""'
    )
  })

  it('exports supported elements that re-import as the same teaching content', async () => {
    const result = await exportElementWorkbook(elements, { includeTags: true })
    expect(result.exportedIds).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.unsupported).toEqual([
      { id: 7, name: 'Case', type: 'CASE_STUDY', reason: 'TYPE_NOT_SUPPORTED' },
      { id: 8, name: 'Too many', type: 'MC', reason: 'TOO_MANY_ANSWERS' },
      {
        id: 9,
        name: 'Missing feedback',
        type: 'SC',
        reason: 'NOT_REPRESENTABLE',
      },
    ])

    const parsed = await parseElementWorkbook(result.buffer)
    const byName = new Map(parsed.map((element) => [element.name, element]))
    for (const element of elements.filter((e) =>
      result.exportedIds.includes(e.id)
    )) {
      const roundTripped = byName.get(element.name)!
      expect(elementIdentity(roundTripped)).toBe(
        elementIdentity(element as Parameters<typeof elementIdentity>[0])
      )
    }
    expect(byName.get('Capital')!.tags).toEqual(['Geography', 'Week; 1'])
  })

  it('leaves tags out on request', async () => {
    const result = await exportElementWorkbook(elements.slice(0, 1), {
      includeTags: false,
    })
    const [element] = await parseElementWorkbook(result.buffer)
    expect(element!.tags).toEqual([])
  })
})
