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

const FINISHED_REVISION_STATUSES = new Set<ElementGenerationBuildStatus>([
  ElementGenerationBuildStatus.Completed,
  ElementGenerationBuildStatus.Incomplete,
  ElementGenerationBuildStatus.Failed,
  ElementGenerationBuildStatus.Rejected,
])

export function isRevisionBuildFinished(status: ElementGenerationBuildStatus) {
  return FINISHED_REVISION_STATUSES.has(status)
}

// A revision request is fulfilled by a child build that keeps running after
// the parent build has settled, so the page keeps polling until it finishes.
export function hasUnfinishedRevision(build: ElementGenerationBuildData) {
  return build.drafts.some((draft) =>
    draft.revisionBuilds.some(
      (revisionBuild) => !isRevisionBuildFinished(revisionBuild.status)
    )
  )
}

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
