import {
  type ElementGenerationBuildQuery,
  ElementGenerationBuildStatus,
  GeneratableElementType,
} from '@klicker-uzh/graphql/dist/ops'

export type ElementGenerationBuildData =
  ElementGenerationBuildQuery['elementGenerationBuild']
export type GeneratedElementDraftData =
  ElementGenerationBuildData['drafts'][number]

export const ELEMENT_TYPE_ORDER = [
  GeneratableElementType.Sc,
  GeneratableElementType.Mc,
  GeneratableElementType.Kprim,
  GeneratableElementType.Flashcard,
] as const

const TERMINAL_STATUSES = new Set<ElementGenerationBuildStatus>([
  ElementGenerationBuildStatus.Completed,
  ElementGenerationBuildStatus.Failed,
  ElementGenerationBuildStatus.Incomplete,
  ElementGenerationBuildStatus.Rejected,
  ElementGenerationBuildStatus.WaitingForDesignReview,
  ElementGenerationBuildStatus.WaitingForPlanReview,
  ElementGenerationBuildStatus.AwaitingIncompletePublication,
])

export function isElementGenerationSettled(
  status: ElementGenerationBuildStatus
) {
  return TERMINAL_STATUSES.has(status)
}

export function elementGenerationErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return undefined

  const graphQLErrors = Reflect.get(error, 'graphQLErrors')
  if (!Array.isArray(graphQLErrors)) return undefined

  for (const graphQLError of graphQLErrors) {
    if (typeof graphQLError !== 'object' || graphQLError === null) continue
    const extensions = Reflect.get(graphQLError, 'extensions')
    if (typeof extensions !== 'object' || extensions === null) continue
    const code = Reflect.get(extensions, 'code')
    if (typeof code === 'string') return code
  }

  return undefined
}
