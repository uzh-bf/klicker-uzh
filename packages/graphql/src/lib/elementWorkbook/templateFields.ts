import { ELEMENT_WORKBOOK_HEADERS } from './parse.js'

export type ElementWorkbookSheet = keyof typeof ELEMENT_WORKBOOK_HEADERS
export type TemplateValue = string | number | null
/** One element row, keyed by template field (see ELEMENT_WORKBOOK_FIELDS). */
export type TemplateRow = Record<string, TemplateValue>
export type TemplateRows = Record<ElementWorkbookSheet, TemplateRow[]>

export const ANSWER_SLOTS = 10
export const KPRIM_SLOTS = 4
export const SOLUTION_SLOTS = 6
export const TEMPLATE_EDIT_ROWS = 2000

const slots = (count: number) =>
  Array.from({ length: count }, (_, index) => index + 1)
const settings = ['explanation', 'basePoints', 'pointsMultiplier']
const choices = (count: number) => [
  'name',
  'content',
  'hasSampleSolution',
  ...slots(count).flatMap((slot) => [`answer${slot}`, `correct${slot}`]),
  ...settings,
  'displayMode',
  'hasAnswerFeedbacks',
  ...slots(count).map((slot) => `feedback${slot}`),
  'tags',
]

/** Field keys per tab, in column order. Labels must equal the parser headers. */
export const ELEMENT_WORKBOOK_FIELDS: Record<ElementWorkbookSheet, string[]> = {
  'Single choice': choices(ANSWER_SLOTS),
  'Multiple choice': choices(ANSWER_SLOTS),
  Kprim: choices(KPRIM_SLOTS),
  Numerical: [
    'name',
    'content',
    'hasSampleSolution',
    'solutionMode',
    ...slots(SOLUTION_SLOTS).flatMap((slot) => [
      `solution${slot}`,
      `solutionMinimum${slot}`,
      `solutionMaximum${slot}`,
    ]),
    ...settings,
    'unit',
    'accuracy',
    'placeholder',
    'minimum',
    'maximum',
    'tags',
  ],
  'Free text': [
    'name',
    'content',
    'hasSampleSolution',
    ...slots(SOLUTION_SLOTS).map((slot) => `solution${slot}`),
    ...settings,
    'maxLength',
    'tags',
  ],
  Content: ['name', 'content', 'explanation', 'tags'],
  Flashcards: ['name', 'content', 'explanation', 'tags'],
}

export function emptyTemplateRows(): TemplateRows {
  return Object.fromEntries(
    Object.keys(ELEMENT_WORKBOOK_HEADERS).map((sheet) => [sheet, []])
  ) as unknown as TemplateRows
}

export function templateColumnLabel(
  sheet: ElementWorkbookSheet,
  field: string
) {
  return ELEMENT_WORKBOOK_HEADERS[sheet][
    ELEMENT_WORKBOOK_FIELDS[sheet].indexOf(field)
  ]!
}
