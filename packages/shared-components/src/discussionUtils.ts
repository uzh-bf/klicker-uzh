import {
  DiscussionScopeType,
  ElementStackType,
  type DiscussionScope,
  type DiscussionScopeInput,
} from '@klicker-uzh/graphql/dist/ops'
import {
  buildCourseDiscussionScopeKey,
  parseCourseDiscussionScopeKey,
} from '@klicker-uzh/types'

type DiscussionScopeLabels = {
  course: string
  practiceStack: (number: number) => string
  microlearningStack: (number: number) => string
}

export function parseScopeKeyToInput(
  courseId: string,
  scopeKey?: string | null
): DiscussionScopeInput | null {
  if (!scopeKey || scopeKey === buildCourseDiscussionScopeKey(courseId)) {
    return { scopeType: DiscussionScopeType.Course }
  }

  const parsedScope = parseCourseDiscussionScopeKey(scopeKey)
  if (!parsedScope) return null

  switch (parsedScope.kind) {
    case 'course':
      return parsedScope.courseId === courseId
        ? { scopeType: DiscussionScopeType.Course }
        : null
    case 'practiceStack':
      return {
        scopeType: DiscussionScopeType.PracticeStack,
        stackId: parsedScope.stackId,
      }
    case 'externalBlock':
      return {
        scopeType: DiscussionScopeType.ExternalBlock,
        externalSource: parsedScope.externalSource,
        externalRef: parsedScope.externalRef,
      }
  }
}

export function getDiscussionScopeDisplayLabel(
  scope:
    | Pick<
        DiscussionScope,
        | 'scopeKey'
        | 'scopeLabel'
        | 'scopeType'
        | 'stackDisplayName'
        | 'stackOrder'
        | 'stackType'
      >
    | null
    | undefined,
  labels: DiscussionScopeLabels
) {
  if (!scope) return ''
  if (scope.scopeType === DiscussionScopeType.Course) return labels.course

  if (scope.scopeType === DiscussionScopeType.PracticeStack) {
    if (scope.stackDisplayName) return scope.stackDisplayName

    if (scope.stackOrder !== null && scope.stackOrder !== undefined) {
      return scope.stackType === ElementStackType.Microlearning
        ? labels.microlearningStack(scope.stackOrder)
        : labels.practiceStack(scope.stackOrder)
    }
  }

  return scope.scopeLabel || scope.scopeKey
}

export function getDiscussionSourceDisplayLabel({
  sourceKey,
  sourceLabel,
  courseLabel,
}: {
  sourceKey?: string | null
  sourceLabel?: string | null
  courseLabel: string
}) {
  return sourceKey &&
    parseCourseDiscussionScopeKey(sourceKey)?.kind === 'course'
    ? courseLabel
    : sourceLabel
}
