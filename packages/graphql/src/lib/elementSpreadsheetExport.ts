import {
  type ElementSpreadsheetTable,
  emptyElementSpreadsheetTables,
  type SpreadsheetValue,
} from './elementSpreadsheetTables.js'
import type {
  PackageAnswerCollection,
  PackageElement,
} from './importExportPackageContract.js'

export function elementSpreadsheetTablesFromElements(
  elements: readonly PackageElement[],
  collections: readonly PackageAnswerCollection[]
) {
  const tables = emptyElementSpreadsheetTables()
  const add = (
    sheet: ElementSpreadsheetTable,
    values: Record<string, SpreadsheetValue | undefined>
  ) => {
    tables[sheet].push({
      sheet,
      row: tables[sheet].length + 2,
      values: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value ?? null])
      ),
    })
  }
  for (const collection of collections) {
    add('Collections', {
      ref: collection.ref,
      name: collection.name,
      description: collection.description,
    })
    for (const entry of collection.entries)
      add('Entries', { collectionRef: collection.ref, ...entry })
  }
  for (const element of elements) {
    const elementRef = element.ref
    const row: Record<string, SpreadsheetValue | undefined> = {
      ref: element.ref,
      type: element.type,
      name: element.name,
      content: element.content,
      explanation: element.explanation,
      basePoints: element.basePoints,
      pointsMultiplier: element.pointsMultiplier,
      answerCollectionRef: element.answerCollectionRef,
    }
    for (const entryRef of element.answerCollectionItemRefs ?? [])
      add('SelectedItems', { elementRef, entryRef })
    switch (element.type) {
      case 'SC':
      case 'MC':
      case 'KPRIM':
        Object.assign(row, {
          hasSampleSolution: element.options.hasSampleSolution,
          displayMode: element.options.displayMode,
          hasAnswerFeedbacks: element.options.hasAnswerFeedbacks,
        })
        for (const choice of element.options.choices)
          add('Choices', {
            elementRef,
            order: choice.ix,
            value: choice.value,
            correct: choice.correct,
            feedback: choice.feedback,
          })
        break
      case 'NUMERICAL':
        Object.assign(row, {
          hasSampleSolution: element.options.hasSampleSolution,
          unit: element.options.unit,
          accuracy: element.options.accuracy,
          placeholder: element.options.placeholder,
          minimum: element.options.restrictions?.min,
          maximum: element.options.restrictions?.max,
        })
        for (const [order, value] of (
          element.options.exactSolutions ?? []
        ).entries())
          add('Solutions', { elementRef, order, value })
        for (const [order, range] of (
          element.options.solutionRanges ?? []
        ).entries())
          add('Solutions', {
            elementRef,
            order,
            minimum: range.min,
            maximum: range.max,
          })
        break
      case 'FREE_TEXT':
        Object.assign(row, {
          hasSampleSolution: element.options.hasSampleSolution,
          maxLength: element.options.restrictions?.maxLength,
        })
        for (const [order, value] of (
          element.options.solutions ?? []
        ).entries())
          add('Solutions', { elementRef, order, value })
        break
      case 'SELECTION':
        Object.assign(row, {
          hasSampleSolution: element.options.hasSampleSolution,
          numberOfInputs: element.options.numberOfInputs,
        })
        break
      case 'CASE_STUDY':
        row.hasSampleSolution = element.options.hasSampleSolution
        for (const criterion of element.options.criteria)
          add('Criteria', {
            elementRef,
            ref: criterion.id,
            order: criterion.order,
            name: criterion.name,
            minimum: criterion.min,
            maximum: criterion.max,
            step: criterion.step,
            unit: criterion.unit,
            labelMin: criterion.labels?.min,
            labelMid: criterion.labels?.mid,
            labelMax: criterion.labels?.max,
          })
        for (const item of element.options.cases) {
          add('Cases', {
            elementRef,
            ref: item.id,
            order: item.order,
            title: item.title,
            description: item.description,
          })
          for (const solution of item.solutions ?? []) {
            for (const criterion of solution.criteriaSolutions)
              add('CaseSolutions', {
                elementRef,
                caseRef: item.id,
                entryRef: String(solution.itemRef),
                criterionRef: criterion.criterionId,
                minimum: criterion.min,
                maximum: criterion.max,
              })
          }
        }
        break
    }
    add('Elements', row)
  }
  return tables
}
