import { z } from 'zod'
import {
  assertUniqueIdentifiers,
  ElementDomainIssueCode,
  finiteNumericalValueSchema,
  isMeaningfulText,
  issue,
  normalizeAuthoredText,
  normalizeNumber,
  normalizeOptionalPlainText,
  normalizePlainText,
  parseWithDomainErrors,
  reservedIdentifiers,
  type ElementReference,
  type ElementRelationContext,
} from './core.js'

const referenceSchema = z.union([
  z.number().int().nonnegative(),
  z
    .string()
    .min(1)
    .max(120)
    .refine((value) => !reservedIdentifiers.has(value)),
])

const caseStudyCriterionSolutionSchema = z
  .object({
    criterionId: z.string().min(1).max(120),
    min: finiteNumericalValueSchema,
    max: finiteNumericalValueSchema,
  })
  .strict()

export function createCaseStudyOptionsSchema(
  referenceKey: 'itemId' | 'itemRef'
) {
  const solutionSchema = z
    .object({
      [referenceKey]: referenceSchema,
      criteriaSolutions: z.array(caseStudyCriterionSolutionSchema),
    })
    .strict()

  return z
    .object({
      hasSampleSolution: z.boolean(),
      criteria: z
        .array(
          z
            .object({
              id: z.string().min(1).max(120),
              name: z.string(),
              order: z.number().int().nonnegative(),
              min: finiteNumericalValueSchema,
              max: finiteNumericalValueSchema,
              step: finiteNumericalValueSchema,
              unit: z.string().nullish(),
              labels: z
                .object({
                  min: z.string(),
                  mid: z.string().nullish(),
                  max: z.string(),
                })
                .strict()
                .nullish(),
            })
            .strict()
        )
        .min(1),
      cases: z
        .array(
          z
            .object({
              id: z.string().min(1).max(120),
              title: z.string(),
              description: z.string(),
              order: z.number().int().nonnegative(),
              solutions: z.array(solutionSchema).nullish(),
            })
            .strict()
        )
        .min(1),
    })
    .strict()
}

const caseStudyAuthoringOptionsSchema = createCaseStudyOptionsSchema(
  'itemId'
).extend({
  answerCollection: z.number().int().nonnegative(),
  collectionItemIds: z.array(z.number().int().nonnegative()).min(1),
})

export type CanonicalCaseStudySolution = {
  criteriaSolutions: Array<{
    criterionId: string
    min: number
    max: number
  }>
} & (
  | { itemId: ElementReference; itemRef?: never }
  | { itemRef: ElementReference; itemId?: never }
)

export type CanonicalCaseStudyOptions = {
  hasSampleSolution: boolean
  criteria: Array<{
    id: string
    name: string
    order: number
    min: number
    max: number
    step: number
    unit?: string
    labels?: { min: string; mid?: string; max: string }
  }>
  cases: Array<{
    id: string
    title: string
    description: string
    order: number
    solutions?: CanonicalCaseStudySolution[]
  }>
}

type CanonicalCaseStudyCase = CanonicalCaseStudyOptions['cases'][number]
type CanonicalCaseStudySolutionEntry = NonNullable<
  CanonicalCaseStudyCase['solutions']
>[number]

export type CaseStudyOptionsWithSolutionReference<
  Options extends CanonicalCaseStudyOptions,
  ReferenceKey extends 'itemId' | 'itemRef',
  Reference extends ElementReference,
> = Omit<Options, 'cases'> & {
  cases: Array<
    Omit<Options['cases'][number], 'solutions'> & {
      solutions?: Array<
        Omit<CanonicalCaseStudySolutionEntry, 'itemId' | 'itemRef'> &
          Record<ReferenceKey, Reference>
      >
    }
  >
}

export function parseCaseStudyAuthoringOptions(value: unknown) {
  return parseWithDomainErrors(
    caseStudyAuthoringOptionsSchema,
    value
  ) as z.infer<ReturnType<typeof createCaseStudyOptionsSchema>> & {
    answerCollection: number
    collectionItemIds: number[]
  }
}

function assertSequentialOrders(
  values: readonly { order: number }[],
  path: readonly (string | number)[]
) {
  const orders = [...values].map((entry) => entry.order).sort((a, b) => a - b)
  if (orders.some((order, index) => order !== index)) {
    issue(ElementDomainIssueCode.INVALID_CASE_STUDY, path)
  }
}

function containsReachableCaseStudyValue({
  criterionMin,
  criterionMax,
  step,
  solutionMin,
  solutionMax,
}: {
  criterionMin: number
  criterionMax: number
  step: number
  solutionMin: number
  solutionMax: number
}) {
  const lowerTolerance =
    Math.max(1, Math.abs(criterionMin), Math.abs(solutionMin)) *
    Number.EPSILON *
    16
  const firstStep = Math.max(
    0,
    Math.ceil((solutionMin - criterionMin - lowerTolerance) / step)
  )
  const reachableValue = criterionMin + firstStep * step
  const solutionTolerance =
    Math.max(1, Math.abs(reachableValue), Math.abs(solutionMax)) *
    Number.EPSILON *
    16
  const criterionTolerance =
    Math.max(1, Math.abs(reachableValue), Math.abs(criterionMax)) *
    Number.EPSILON *
    16

  return (
    reachableValue <= criterionMax + criterionTolerance &&
    reachableValue <= solutionMax + solutionTolerance
  )
}

export function normalizeCaseStudyOptions(
  value: unknown,
  referenceKey: 'itemId' | 'itemRef'
): CanonicalCaseStudyOptions {
  const parsed = parseWithDomainErrors(
    createCaseStudyOptionsSchema(referenceKey),
    value
  ) as {
    hasSampleSolution: boolean
    criteria: Array<{
      id: string
      name: string
      order: number
      min: number
      max: number
      step: number
      unit?: string | null
      labels?: { min: string; mid?: string | null; max: string } | null
    }>
    cases: Array<{
      id: string
      title: string
      description: string
      order: number
      solutions?: Array<{
        itemId?: ElementReference
        itemRef?: ElementReference
        criteriaSolutions: Array<{
          criterionId: string
          min: number
          max: number
        }>
      }> | null
    }>
  }
  const criteria = [...parsed.criteria].sort(
    (left, right) => left.order - right.order
  )
  const cases = [...parsed.cases].sort(
    (left, right) => left.order - right.order
  )

  assertSequentialOrders(criteria, ['options', 'criteria'])
  assertSequentialOrders(cases, ['options', 'cases'])
  assertUniqueIdentifiers(
    criteria.map((criterion) => criterion.id),
    ['options', 'criteria']
  )
  assertUniqueIdentifiers(
    cases.map((caseItem) => caseItem.id),
    ['options', 'cases']
  )

  const criterionById = new Map(
    criteria.map((criterion) => [criterion.id, criterion])
  )
  const criterionOrderById = new Map(
    criteria.map((criterion, index) => [criterion.id, index])
  )
  for (const [index, criterion] of criteria.entries()) {
    if (
      reservedIdentifiers.has(criterion.id) ||
      !isMeaningfulText(criterion.name) ||
      criterion.min >= criterion.max ||
      criterion.step <= 0 ||
      criterion.step > criterion.max - criterion.min
    ) {
      issue(ElementDomainIssueCode.INVALID_CASE_STUDY, [
        'options',
        'criteria',
        index,
      ])
    }
    if (
      criterion.labels &&
      (!isMeaningfulText(criterion.labels.min) ||
        !isMeaningfulText(criterion.labels.max) ||
        (typeof criterion.labels.mid === 'string' &&
          !isMeaningfulText(criterion.labels.mid)))
    ) {
      issue(ElementDomainIssueCode.INVALID_CASE_STUDY, [
        'options',
        'criteria',
        index,
        'labels',
      ])
    }
  }

  for (const [caseIndex, caseItem] of cases.entries()) {
    if (
      reservedIdentifiers.has(caseItem.id) ||
      !isMeaningfulText(caseItem.title) ||
      !isMeaningfulText(caseItem.description)
    ) {
      issue(ElementDomainIssueCode.INVALID_CASE_STUDY, [
        'options',
        'cases',
        caseIndex,
      ])
    }

    if (!parsed.hasSampleSolution) continue
    if (!caseItem.solutions) {
      issue(ElementDomainIssueCode.INVALID_CASE_STUDY, [
        'options',
        'cases',
        caseIndex,
        'solutions',
      ])
    }

    const solutionReferences = caseItem.solutions.map(
      (solution) => solution[referenceKey] as ElementReference
    )
    assertUniqueIdentifiers(solutionReferences, [
      'options',
      'cases',
      caseIndex,
      'solutions',
    ])

    for (const [solutionIndex, solution] of caseItem.solutions.entries()) {
      assertUniqueIdentifiers(
        solution.criteriaSolutions.map((entry) => entry.criterionId),
        [
          'options',
          'cases',
          caseIndex,
          'solutions',
          solutionIndex,
          'criteriaSolutions',
        ]
      )
      if (solution.criteriaSolutions.length !== criteria.length) {
        issue(ElementDomainIssueCode.INVALID_CASE_STUDY)
      }

      for (const criterionSolution of solution.criteriaSolutions) {
        const criterion = criterionById.get(criterionSolution.criterionId)
        if (
          !criterion ||
          criterionSolution.min > criterionSolution.max ||
          criterionSolution.min < criterion.min ||
          criterionSolution.max > criterion.max ||
          !containsReachableCaseStudyValue({
            criterionMin: criterion.min,
            criterionMax: criterion.max,
            step: criterion.step,
            solutionMin: criterionSolution.min,
            solutionMax: criterionSolution.max,
          })
        ) {
          issue(ElementDomainIssueCode.INVALID_CASE_STUDY)
        }
      }
    }
  }

  return {
    hasSampleSolution: parsed.hasSampleSolution,
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      name: normalizePlainText(criterion.name),
      order: criterion.order,
      min: normalizeNumber(criterion.min),
      max: normalizeNumber(criterion.max),
      step: normalizeNumber(criterion.step),
      unit: normalizeOptionalPlainText(criterion.unit),
      labels: criterion.labels
        ? {
            min: normalizePlainText(criterion.labels.min),
            mid: normalizeOptionalPlainText(criterion.labels.mid),
            max: normalizePlainText(criterion.labels.max),
          }
        : undefined,
    })),
    cases: cases.map((caseItem) => ({
      id: caseItem.id,
      title: normalizePlainText(caseItem.title),
      description: normalizeAuthoredText(caseItem.description),
      order: caseItem.order,
      solutions: parsed.hasSampleSolution
        ? caseItem.solutions!.map((solution) => ({
            ...(referenceKey === 'itemId'
              ? { itemId: solution.itemId as ElementReference }
              : { itemRef: solution.itemRef as ElementReference }),
            criteriaSolutions: [...solution.criteriaSolutions]
              .sort(
                (left, right) =>
                  criterionOrderById.get(left.criterionId)! -
                  criterionOrderById.get(right.criterionId)!
              )
              .map((entry) => ({
                criterionId: entry.criterionId,
                min: normalizeNumber(entry.min),
                max: normalizeNumber(entry.max),
              })),
          }))
        : undefined,
    })),
  }
}

export function canonicalizeCaseStudyRelations<Id extends ElementReference>(
  options: Record<string, unknown>,
  relations?: ElementRelationContext<Id>
) {
  if (
    typeof relations?.answerCollectionId === 'undefined' &&
    typeof relations?.poolIds === 'undefined' &&
    typeof relations?.selectedIds === 'undefined'
  ) {
    return { selectedIds: [] as Id[] }
  }

  if (typeof relations?.answerCollectionId === 'undefined') {
    issue(ElementDomainIssueCode.INVALID_RELATION, ['relations'])
  }

  const poolIds = [...(relations.poolIds ?? [])]
  const selectedIds = [...(relations.selectedIds ?? [])]
  if (relations.poolIds) {
    assertUniqueIdentifiers(poolIds, ['relations', 'poolIds'])
  }
  assertUniqueIdentifiers(selectedIds, ['relations', 'selectedIds'])
  if (relations.poolIds) {
    const pool = new Set<ElementReference>(poolIds)
    if (selectedIds.some((id) => !pool.has(id))) {
      issue(ElementDomainIssueCode.INVALID_RELATION, [
        'relations',
        'selectedIds',
      ])
    }
  }

  if (selectedIds.length === 0) {
    issue(ElementDomainIssueCode.INVALID_RELATION, ['relations', 'selectedIds'])
  }

  if (options.hasSampleSolution === true) {
    const referenceKey = relations.caseSolutionReferenceKey ?? 'itemId'
    const expectedItems = new Set<ElementReference>(selectedIds)
    const criteria = options.criteria as Array<{ id: string }>
    const expectedCriteria = new Set(criteria.map((criterion) => criterion.id))
    const cases = options.cases as Array<{
      solutions?: Array<
        Record<'criteriaSolutions', Array<{ criterionId: string }>> &
          Record<string, unknown>
      >
    }>

    for (const caseItem of cases) {
      const solutions = caseItem.solutions ?? []
      const solutionItems = new Set<ElementReference>(
        solutions.map((solution) => solution[referenceKey] as ElementReference)
      )
      if (
        solutionItems.size !== expectedItems.size ||
        [...expectedItems].some((id) => !solutionItems.has(id))
      ) {
        issue(ElementDomainIssueCode.INVALID_CASE_STUDY)
      }

      for (const solution of solutions) {
        const solutionCriteria = new Set(
          solution.criteriaSolutions.map((entry) => entry.criterionId)
        )
        if (
          solutionCriteria.size !== expectedCriteria.size ||
          [...expectedCriteria].some((id) => !solutionCriteria.has(id))
        ) {
          issue(ElementDomainIssueCode.INVALID_CASE_STUDY)
        }
      }
    }
  }

  return {
    answerCollectionId: relations.answerCollectionId,
    selectedIds,
  }
}
