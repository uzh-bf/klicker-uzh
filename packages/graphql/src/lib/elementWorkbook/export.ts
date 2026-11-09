import {
  ELEMENT_WORKBOOK_DATA_ROW,
  ElementWorkbookParseError,
  parseElementWorkbook,
  type WorkbookElement,
} from './parse.js'
import { elementIdentity } from './plan.js'
import { writeElementWorkbook } from './template.js'
import {
  ANSWER_SLOTS,
  type ElementWorkbookSheet,
  emptyTemplateRows,
  KPRIM_SLOTS,
  SOLUTION_SLOTS,
  type TemplateRow,
} from './templateFields.js'

export type ExportableElement = {
  id: number
  type: string
  name: string
  content: string
  explanation: string | null
  basePoints: boolean
  pointsMultiplier: number
  options: unknown
  tags: string[]
}

export type UnsupportedReason =
  | 'TYPE_NOT_SUPPORTED'
  | 'TOO_MANY_ANSWERS'
  | 'NOT_REPRESENTABLE'

export type UnsupportedElement = {
  id: number
  name: string
  type: string
  reason: UnsupportedReason
}

const SHEETS: Partial<Record<string, ElementWorkbookSheet>> = {
  SC: 'Single choice',
  MC: 'Multiple choice',
  KPRIM: 'Kprim',
  NUMERICAL: 'Numerical',
  FREE_TEXT: 'Free text',
  CONTENT: 'Content',
  FLASHCARD: 'Flashcards',
}

const yesNo = (value: unknown) => (value === true ? 'Yes' : 'No')
const optional = <T>(value: T | null | undefined) => value ?? null

/** Quote tags the importer would otherwise split or trim. */
export function formatWorkbookTags(tags: string[]) {
  return tags
    .map((tag) =>
      /[;"]|^\s|\s$/.test(tag) ? `"${tag.replaceAll('"', '""')}"` : tag
    )
    .join('; ')
}

function toTemplateRow(
  element: ExportableElement,
  includeTags: boolean
): TemplateRow | UnsupportedReason {
  const options = (element.options ?? {}) as {
    choices?: Array<{
      ix: number
      value: string
      correct?: boolean
      feedback?: string | null
    }>
    displayMode?: string
    hasSampleSolution?: boolean
    hasAnswerFeedbacks?: boolean
    exactSolutions?: number[]
    solutionRanges?: Array<{ min?: number | null; max?: number | null }>
    solutions?: string[]
    unit?: string | null
    accuracy?: number | null
    placeholder?: string | null
    restrictions?: {
      min?: number | null
      max?: number | null
      maxLength?: number | null
    } | null
  }
  const row: TemplateRow = {
    name: element.name,
    content: element.content,
    explanation: element.explanation || null,
    tags: includeTags ? formatWorkbookTags(element.tags) || null : null,
  }
  const scored = () => {
    row.basePoints = yesNo(element.basePoints)
    row.pointsMultiplier = element.pointsMultiplier
  }
  switch (element.type) {
    case 'SC':
    case 'MC':
    case 'KPRIM': {
      const choices = [...(options.choices ?? [])].sort(
        (a, b) => Number(a.ix) - Number(b.ix)
      )
      const max = element.type === 'KPRIM' ? KPRIM_SLOTS : ANSWER_SLOTS
      if (choices.length > max) return 'TOO_MANY_ANSWERS'
      const hasSampleSolution = options.hasSampleSolution === true
      const hasAnswerFeedbacks = options.hasAnswerFeedbacks === true
      row.hasSampleSolution = yesNo(hasSampleSolution)
      row.hasAnswerFeedbacks = yesNo(hasAnswerFeedbacks)
      row.displayMode = options.displayMode ?? 'LIST'
      choices.forEach((choice, index) => {
        row[`answer${index + 1}`] = choice.value
        if (hasSampleSolution)
          row[`correct${index + 1}`] = yesNo(choice.correct)
        if (hasAnswerFeedbacks)
          row[`feedback${index + 1}`] = optional(choice.feedback)
      })
      scored()
      return row
    }
    case 'NUMERICAL': {
      const exact = options.exactSolutions ?? []
      const ranges = options.solutionRanges ?? []
      if (exact.length > SOLUTION_SLOTS || ranges.length > SOLUTION_SLOTS)
        return 'TOO_MANY_ANSWERS'
      const hasSampleSolution = options.hasSampleSolution === true
      row.hasSampleSolution = yesNo(hasSampleSolution)
      if (hasSampleSolution) {
        row.solutionMode = ranges.length > 0 ? 'RANGE' : 'EXACT'
        if (ranges.length > 0) {
          ranges.forEach((range, index) => {
            row[`solutionMinimum${index + 1}`] = optional(range.min)
            row[`solutionMaximum${index + 1}`] = optional(range.max)
          })
        } else {
          exact.forEach((value, index) => {
            row[`solution${index + 1}`] = value
          })
        }
      }
      row.unit = options.unit || null
      row.accuracy = optional(options.accuracy)
      row.placeholder = options.placeholder || null
      row.minimum = optional(options.restrictions?.min)
      row.maximum = optional(options.restrictions?.max)
      scored()
      return row
    }
    case 'FREE_TEXT': {
      const solutions = options.solutions ?? []
      if (solutions.length > SOLUTION_SLOTS) return 'TOO_MANY_ANSWERS'
      const hasSampleSolution = options.hasSampleSolution === true
      row.hasSampleSolution = yesNo(hasSampleSolution)
      if (hasSampleSolution)
        solutions.forEach((value, index) => {
          row[`solution${index + 1}`] = value
        })
      row.maxLength = optional(options.restrictions?.maxLength)
      scored()
      return row
    }
    case 'CONTENT':
    case 'FLASHCARD':
      return row
    default:
      return 'TYPE_NOT_SUPPORTED'
  }
}

/**
 * Builds a filled template and proves every exported row parses back to the
 * same teaching content. Rows that would not survive the round trip are left
 * out and reported instead of being exported with silent changes.
 */
export async function exportElementWorkbook(
  elements: ExportableElement[],
  { includeTags }: { includeTags: boolean }
) {
  const unsupported: UnsupportedElement[] = []
  let candidates: Array<{ element: ExportableElement; row: TemplateRow }> = []
  for (const element of elements) {
    const result = toTemplateRow(element, includeTags)
    if (typeof result === 'string') {
      unsupported.push({
        id: element.id,
        name: element.name,
        type: element.type,
        reason: result,
      })
    } else {
      candidates.push({ element, row: result })
    }
  }

  const exclude = (element: ExportableElement) => {
    unsupported.push({
      id: element.id,
      name: element.name,
      type: element.type,
      reason: 'NOT_REPRESENTABLE',
    })
    candidates = candidates.filter((c) => c.element.id !== element.id)
  }

  // Each pass removes at least one candidate, so this terminates.
  for (;;) {
    const rows = emptyTemplateRows()
    const positions = new Map<string, ExportableElement>()
    for (const { element, row } of candidates) {
      const sheet = SHEETS[element.type]!
      positions.set(
        `${sheet}:${rows[sheet].length + ELEMENT_WORKBOOK_DATA_ROW}`,
        element
      )
      rows[sheet].push(row)
    }
    const buffer = await writeElementWorkbook(rows)
    let parsed: WorkbookElement[]
    try {
      parsed = await parseElementWorkbook(buffer)
    } catch (error) {
      const failed =
        error instanceof ElementWorkbookParseError && error.sheet && error.row
          ? positions.get(`${error.sheet}:${error.row}`)
          : undefined
      if (!failed) throw error
      exclude(failed)
      continue
    }
    const lossy = parsed
      .map((item) => ({
        item,
        element: positions.get(`${item.sheet}:${item.row}`)!,
      }))
      .filter(
        ({ item, element }) =>
          elementIdentity(item) !==
          elementIdentity(element as Parameters<typeof elementIdentity>[0])
      )
      .map(({ element }) => element)
    if (lossy.length === 0) {
      return {
        buffer,
        exportedIds: candidates.map(({ element }) => element.id),
        unsupported,
      }
    }
    lossy.forEach(exclude)
  }
}
