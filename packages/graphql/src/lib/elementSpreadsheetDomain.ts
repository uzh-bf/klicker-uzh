import { canonicalizeElementDomain } from './elementDomain.js'
import {
  booleanCell as boolean,
  type ElementSpreadsheetTable,
  type ElementSpreadsheetTables,
  numberCell as number,
  SpreadsheetCellError,
  type SpreadsheetIssue,
  type SpreadsheetRow,
  textCell as text,
} from './elementSpreadsheetTables.js'
import { InvalidElementWorkbookError } from './elementSpreadsheetWorkbook.js'
import {
  answerCollectionSchema,
  elementSchema,
  type PackageAnswerCollection,
  type PackageElement,
} from './importExportPackageContract.js'

export type ParsedElementSpreadsheet = {
  elements: PackageElement[]
  answerCollections: PackageAnswerCollection[]
  sources: Array<{ ref: string; sheet: string; row: number; name: string }>
  issues: SpreadsheetIssue[]
}

function optionsForElement(
  row: SpreadsheetRow,
  related: (table: ElementSpreadsheetTable) => SpreadsheetRow[]
) {
  const hasSampleSolution = boolean(row, 'hasSampleSolution')
  switch (text(row, 'type')) {
    case 'SC':
    case 'MC':
    case 'KPRIM':
      return {
        hasSampleSolution,
        displayMode: text(row, 'displayMode', 'LIST'),
        hasAnswerFeedbacks: boolean(row, 'hasAnswerFeedbacks'),
        choices: related('Choices').map((choice) => ({
          ix: number(choice, 'order'),
          value: text(choice, 'value'),
          correct:
            hasSampleSolution &&
            (choice.values.correct == null || choice.values.correct === '')
              ? undefined
              : boolean(choice, 'correct'),
          feedback: text(choice, 'feedback', ''),
        })),
      }
    case 'NUMERICAL': {
      const solutions = related('Solutions')
      for (const solution of solutions) {
        if (
          number(solution, 'value') !== undefined &&
          (number(solution, 'minimum') !== undefined ||
            number(solution, 'maximum') !== undefined)
        ) {
          throw new SpreadsheetCellError(
            'value',
            'AMBIGUOUS_SOLUTION',
            solution
          )
        }
      }
      return {
        hasSampleSolution,
        unit: text(row, 'unit', ''),
        accuracy: number(row, 'accuracy'),
        placeholder: text(row, 'placeholder', ''),
        restrictions: {
          min: number(row, 'minimum'),
          max: number(row, 'maximum'),
        },
        exactSolutions: solutions
          .filter((solution) => number(solution, 'value') !== undefined)
          .map((solution) => number(solution, 'value')),
        solutionRanges: solutions
          .filter((solution) => number(solution, 'value') === undefined)
          .map((solution) => ({
            min: number(solution, 'minimum'),
            max: number(solution, 'maximum'),
          })),
      }
    }
    case 'FREE_TEXT':
      return {
        hasSampleSolution,
        restrictions: { maxLength: number(row, 'maxLength') },
        solutions: related('Solutions').map((solution) =>
          text(solution, 'value')
        ),
      }
    case 'SELECTION':
      return {
        hasSampleSolution,
        numberOfInputs: number(row, 'numberOfInputs'),
      }
    case 'CASE_STUDY':
      return {
        hasSampleSolution,
        criteria: related('Criteria').map((criterion) => ({
          id: text(criterion, 'ref'),
          order: number(criterion, 'order'),
          name: text(criterion, 'name'),
          min: number(criterion, 'minimum'),
          max: number(criterion, 'maximum'),
          step: number(criterion, 'step'),
          unit: text(criterion, 'unit', ''),
          labels:
            text(criterion, 'labelMin', '') ||
            text(criterion, 'labelMax', '') ||
            text(criterion, 'labelMid', '')
              ? {
                  min: text(criterion, 'labelMin'),
                  mid: text(criterion, 'labelMid', '') || undefined,
                  max: text(criterion, 'labelMax'),
                }
              : undefined,
        })),
        cases: related('Cases').map((caseRow) => {
          const rows = related('CaseSolutions').filter(
            (solution) => text(solution, 'caseRef') === text(caseRow, 'ref')
          )
          const entries = [
            ...new Set(rows.map((solution) => text(solution, 'entryRef'))),
          ]
          return {
            id: text(caseRow, 'ref'),
            order: number(caseRow, 'order'),
            title: text(caseRow, 'title'),
            description: text(caseRow, 'description'),
            solutions: entries.map((itemRef) => ({
              itemRef,
              criteriaSolutions: rows
                .filter((solution) => text(solution, 'entryRef') === itemRef)
                .map((solution) => ({
                  criterionId: text(solution, 'criterionRef'),
                  min: number(solution, 'minimum'),
                  max: number(solution, 'maximum'),
                })),
            })),
          }
        }),
      }
    case 'CONTENT':
    case 'FLASHCARD':
      return {}
    default:
      throw new SpreadsheetCellError('type', 'UNSUPPORTED_ELEMENT_TYPE')
  }
}

export function parseElementSpreadsheetTables(
  tables: ElementSpreadsheetTables,
  cellIssues: SpreadsheetIssue[] = []
): ParsedElementSpreadsheet {
  if (
    tables.Elements.length > 100 ||
    tables.Collections.length > 50 ||
    tables.Entries.length > 5000
  ) {
    throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
  }
  const issues = [...cellIssues]
  const sources: ParsedElementSpreadsheet['sources'] = []
  const elements: PackageElement[] = []
  const answerCollections: PackageAnswerCollection[] = []
  const invalidRows = new Set(
    cellIssues.map((issue) => `${issue.sheet}:${issue.row}`)
  )
  const refCounts = new Map<string, number>()
  for (const row of [
    ...tables.Elements,
    ...tables.Collections,
    ...tables.Entries,
  ]) {
    const ref = row.values.ref
    if (typeof ref === 'string')
      refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1)
  }
  const report = (row: SpreadsheetRow, error: unknown) => {
    const source =
      error instanceof SpreadsheetCellError ? error.source : undefined
    const ref =
      row.values.ref ?? row.values.elementRef ?? row.values.collectionRef
    issues.push({
      sheet: source?.sheet ?? row.sheet,
      row: source?.row ?? row.row,
      ref: typeof ref === 'string' ? ref : null,
      field: error instanceof SpreadsheetCellError ? error.field : '',
      code:
        error instanceof SpreadsheetCellError ? error.code : 'INVALID_ELEMENT',
    })
  }
  const checkRow = (row: SpreadsheetRow) => {
    if (invalidRows.has(`${row.sheet}:${row.row}`))
      throw new SpreadsheetCellError('', 'INVALID_DEPENDENCY')
  }
  // Orphaned data is reported explicitly; it cannot silently become content.
  for (const [name, rows] of Object.entries(tables)) {
    if (name === 'Elements' || name === 'Collections') continue
    const ownerKey = name === 'Entries' ? 'collectionRef' : 'elementRef'
    const owners = name === 'Entries' ? tables.Collections : tables.Elements
    for (const row of rows) {
      if (!owners.some((owner) => owner.values.ref === row.values[ownerKey]))
        report(row, new SpreadsheetCellError(ownerKey, 'UNKNOWN_REFERENCE'))
    }
  }
  for (const row of tables.Collections) {
    try {
      checkRow(row)
      const ref = text(row, 'ref')
      if (refCounts.get(ref) !== 1)
        throw new SpreadsheetCellError('ref', 'DUPLICATE_REFERENCE')
      const entries = tables.Entries.filter(
        (entry) => entry.values.collectionRef === ref
      )
      entries.forEach(checkRow)
      for (const entry of entries) {
        if (refCounts.get(text(entry, 'ref')) !== 1)
          throw new SpreadsheetCellError('ref', 'DUPLICATE_REFERENCE', entry)
      }
      if (
        new Set(entries.map((entry) => entry.values.ref)).size !==
        entries.length
      )
        throw new SpreadsheetCellError('ref', 'DUPLICATE_REFERENCE')
      answerCollections.push(
        answerCollectionSchema.parse({
          ref,
          name: text(row, 'name'),
          description: text(row, 'description', ''),
          entries: entries.map((entry) => ({
            ref: text(entry, 'ref'),
            value: text(entry, 'value'),
          })),
        })
      )
    } catch (error) {
      report(row, error)
    }
  }
  for (const row of tables.Elements) {
    try {
      checkRow(row)
      const ref = text(row, 'ref')
      if (refCounts.get(ref) !== 1)
        throw new SpreadsheetCellError('ref', 'DUPLICATE_REFERENCE')
      const related = (table: ElementSpreadsheetTable) => {
        const rows = tables[table].filter(
          (entry) => entry.values.elementRef === ref
        )
        rows.forEach(checkRow)
        if (table === 'Solutions') {
          rows.sort(
            (a, b) => (number(a, 'order') ?? -1) - (number(b, 'order') ?? -1)
          )
          for (const [index, solution] of rows.entries()) {
            if (number(solution, 'order') !== index)
              throw new SpreadsheetCellError('order', 'INVALID_ORDER', solution)
          }
        }
        return rows
      }
      const type = text(row, 'type')
      const hasSampleSolution = boolean(row, 'hasSampleSolution')
      if (['SC', 'MC', 'KPRIM'].includes(type)) {
        const hasFeedback = boolean(row, 'hasAnswerFeedbacks')
        if (hasFeedback && !hasSampleSolution)
          throw new SpreadsheetCellError(
            'hasAnswerFeedbacks',
            'DISABLED_SOLUTION_DATA',
            row
          )
        for (const choice of related('Choices')) {
          for (const field of ['correct', 'feedback'] as const) {
            const enabled =
              field === 'correct'
                ? hasSampleSolution
                : hasSampleSolution && hasFeedback
            if (
              !enabled &&
              choice.values[field] != null &&
              choice.values[field] !== ''
            )
              throw new SpreadsheetCellError(
                field,
                'DISABLED_SOLUTION_DATA',
                choice
              )
          }
        }
      }
      const solutionTable =
        type === 'CASE_STUDY'
          ? 'CaseSolutions'
          : type === 'SELECTION'
            ? 'SelectedItems'
            : ['NUMERICAL', 'FREE_TEXT'].includes(type)
              ? 'Solutions'
              : null
      if (!hasSampleSolution && solutionTable) {
        const disabledRows = related(solutionTable)
        if (disabledRows.length)
          throw new SpreadsheetCellError(
            'hasSampleSolution',
            'DISABLED_SOLUTION_DATA',
            disabledRows[0]
          )
      }
      const commonFields = [
        'ref',
        'type',
        'name',
        'content',
        'explanation',
        'basePoints',
        'pointsMultiplier',
      ]
      const typeFields: Record<string, string[]> = {
        SC: ['hasSampleSolution', 'displayMode', 'hasAnswerFeedbacks'],
        MC: ['hasSampleSolution', 'displayMode', 'hasAnswerFeedbacks'],
        KPRIM: ['hasSampleSolution', 'displayMode', 'hasAnswerFeedbacks'],
        NUMERICAL: [
          'hasSampleSolution',
          'unit',
          'accuracy',
          'placeholder',
          'minimum',
          'maximum',
        ],
        FREE_TEXT: ['hasSampleSolution', 'maxLength'],
        SELECTION: [
          'hasSampleSolution',
          'numberOfInputs',
          'answerCollectionRef',
        ],
        CASE_STUDY: ['hasSampleSolution', 'answerCollectionRef'],
        CONTENT: [],
        FLASHCARD: [],
      }
      const allowedFields = new Set([
        ...commonFields,
        ...(typeFields[type] ?? []),
      ])
      for (const [field, value] of Object.entries(row.values)) {
        if (value != null && value !== '' && !allowedFields.has(field))
          throw new SpreadsheetCellError(field, 'UNEXPECTED_VALUE', row)
      }
      if (type === 'FREE_TEXT') {
        for (const solution of related('Solutions')) {
          if (
            solution.values.minimum != null ||
            solution.values.maximum != null
          )
            throw new SpreadsheetCellError(
              'minimum',
              'UNEXPECTED_VALUE',
              solution
            )
        }
      }
      const allowed = new Set(
        type === 'CASE_STUDY'
          ? ['SelectedItems', 'Criteria', 'Cases', 'CaseSolutions']
          : type === 'SELECTION'
            ? ['SelectedItems']
            : ['SC', 'MC', 'KPRIM'].includes(type)
              ? ['Choices']
              : ['NUMERICAL', 'FREE_TEXT'].includes(type)
                ? ['Solutions']
                : []
      )
      for (const name of [
        'Choices',
        'Solutions',
        'SelectedItems',
        'Criteria',
        'Cases',
        'CaseSolutions',
      ] as const) {
        if (!allowed.has(name) && related(name).length)
          throw new SpreadsheetCellError(name, 'UNEXPECTED_DEPENDENCY')
      }
      if (
        type === 'CASE_STUDY' &&
        related('CaseSolutions').some(
          (solution) =>
            !related('Cases').some(
              (caseRow) => caseRow.values.ref === solution.values.caseRef
            )
        )
      )
        throw new SpreadsheetCellError('caseRef', 'UNKNOWN_REFERENCE')
      const collectionRef = text(row, 'answerCollectionRef', '') || undefined
      const collection = answerCollections.find(
        (entry) => entry.ref === collectionRef
      )
      if (collectionRef && !collection)
        throw new SpreadsheetCellError(
          'answerCollectionRef',
          'INVALID_DEPENDENCY'
        )
      const element = elementSchema.parse({
        ref,
        type,
        name: text(row, 'name'),
        content: text(row, 'content'),
        explanation: text(row, 'explanation', '') || null,
        basePoints: boolean(row, 'basePoints', true),
        pointsMultiplier: number(row, 'pointsMultiplier', 1),
        options: optionsForElement(row, related),
        answerCollectionRef: collectionRef,
        answerCollectionItemRefs: collectionRef
          ? related('SelectedItems').map((entry) => text(entry, 'entryRef'))
          : undefined,
      })
      canonicalizeElementDomain({
        ...element,
        relations: collection
          ? {
              answerCollectionId: collection.ref,
              poolIds: collection.entries.map((entry) => entry.ref),
              selectedIds: element.answerCollectionItemRefs ?? [],
              caseSolutionReferenceKey: 'itemRef',
            }
          : undefined,
      })
      elements.push(element)
      sources.push({ ref, sheet: row.sheet, row: row.row, name: element.name })
    } catch (error) {
      report(row, error)
    }
  }
  const validElements = new Set(elements.map((element) => element.ref))
  const validCollections = new Set(
    answerCollections.map((collection) => collection.ref)
  )
  for (const [name, rows] of Object.entries(tables)) {
    if (name === 'Elements' || name === 'Collections') continue
    for (const row of rows) {
      const ref =
        row.values[name === 'Entries' ? 'collectionRef' : 'elementRef']
      const valid = name === 'Entries' ? validCollections : validElements
      if (
        typeof ref === 'string' &&
        !valid.has(ref) &&
        !issues.some(
          (issue) => issue.sheet === row.sheet && issue.row === row.row
        )
      ) {
        report(row, new SpreadsheetCellError('', 'INVALID_DEPENDENCY'))
      }
    }
  }
  return { elements, answerCollections, sources, issues }
}
