import { createHash } from 'node:crypto'
import type { WorkbookElement } from './parse.js'

/** Deterministic JSON for payload/state hashes, independent of key insertion order. */
export function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function digest(value: unknown) {
  return createHash('sha256').update(canonical(value)).digest('hex')
}

type IdentityInput = Pick<
  WorkbookElement,
  'type' | 'content' | 'explanation' | 'basePoints' | 'pointsMultiplier'
> & { options: unknown }

/** Titles, tags, review state, and internal choice ids are not teaching content. */
export function elementIdentity(element: IdentityInput): string | null {
  let options: unknown = {}
  if (element.type === 'MC') {
    const input = element.options as Record<string, unknown> | null
    if (!input || !Array.isArray(input.choices)) return null
    const hasSampleSolution = input.hasSampleSolution === true
    const hasAnswerFeedbacks = input.hasAnswerFeedbacks === true
    const choices = input.choices as Record<string, unknown>[]
    if (
      choices.some(
        (choice) =>
          !choice ||
          typeof choice.value !== 'string' ||
          !Number.isInteger(choice.ix)
      )
    )
      return null
    options = {
      displayMode: input.displayMode ?? 'LIST',
      hasSampleSolution,
      hasAnswerFeedbacks,
      choices: [...choices]
        .sort((a, b) => Number(a.ix) - Number(b.ix))
        .map((choice) => ({
          value: choice.value,
          ...(hasSampleSolution ? { correct: choice.correct } : {}),
          ...(hasAnswerFeedbacks ? { feedback: choice.feedback ?? '' } : {}),
        })),
    }
  }
  return digest({
    type: element.type,
    content: element.content,
    explanation: element.explanation || null,
    basePoints: element.basePoints,
    pointsMultiplier: element.pointsMultiplier,
    options,
  })
}

export type ExistingIdentity = { id: number; identity: string | null }
export type ImportDecision = {
  sheet: string
  row: number
  name: string
  identity: string
  action: 'CREATE' | 'SKIP_EXISTING' | 'SKIP_WORKBOOK'
  existingId?: number
  firstRow?: number
}

export function planImport(
  elements: WorkbookElement[],
  existing: ExistingIdentity[]
): ImportDecision[] {
  const library = new Map<string, number>()
  for (const item of existing) {
    if (item.identity && !library.has(item.identity))
      library.set(item.identity, item.id)
  }
  const seen = new Map<string, number>()
  return elements.map((element) => {
    const identity = elementIdentity(element)
    if (!identity) throw new Error('Cannot identify a validated element')
    const base = {
      sheet: element.sheet,
      row: element.row,
      name: element.name,
      identity,
    }
    const existingId = library.get(identity)
    if (existingId !== undefined)
      return { ...base, action: 'SKIP_EXISTING', existingId }
    const firstRow = seen.get(identity)
    if (firstRow !== undefined)
      return { ...base, action: 'SKIP_WORKBOOK', firstRow }
    seen.set(identity, element.row)
    return { ...base, action: 'CREATE' }
  })
}

export function comparisonCsv(decisions: ImportDecision[]) {
  const escapeCell = (value: unknown) => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return [
    ['sheet', 'row', 'name', 'action', 'existingId', 'firstRow'],
    ...decisions.map((d) => [
      d.sheet,
      d.row,
      d.name,
      d.action,
      d.existingId,
      d.firstRow,
    ]),
  ]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n')
}
