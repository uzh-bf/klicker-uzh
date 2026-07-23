import {
  DiscussionScopeType,
  type DiscussionScope,
  type DiscussionScopeInput,
} from '@klicker-uzh/graphql/dist/ops'

type DiscussionScopeLabels = {
  course: string
  stack: (number: number) => string
}

export function parseScopeKeyToInput(
  courseId: string,
  scopeKey?: string | null
): DiscussionScopeInput | null {
  if (!scopeKey || scopeKey === `course:${courseId}`) {
    return { scopeType: DiscussionScopeType.Course }
  }

  const practiceStackMatch = scopeKey.match(/^stack:(\d+)$/)
  if (practiceStackMatch) {
    return {
      scopeType: DiscussionScopeType.PracticeStack,
      stackId: Number.parseInt(practiceStackMatch[1] ?? '', 10),
    }
  }

  const externalMatch = scopeKey.match(/^ext:([^:]+):(.+)$/)
  if (externalMatch) {
    return {
      scopeType: DiscussionScopeType.ExternalBlock,
      externalSource: decodeURIComponent(externalMatch[1] ?? ''),
      externalRef: decodeURIComponent(externalMatch[2] ?? ''),
    }
  }
  return null
}

export function getDiscussionScopeDisplayLabel(
  scope:
    | Pick<DiscussionScope, 'scopeKey' | 'scopeLabel' | 'scopeType'>
    | null
    | undefined,
  labels: DiscussionScopeLabels
) {
  if (!scope) return ''
  if (scope.scopeType === DiscussionScopeType.Course) return labels.course

  if (scope.scopeType === DiscussionScopeType.PracticeStack) {
    const fallbackMatch = scope.scopeLabel.match(
      /^(?:Practice|Microlearning) Stack (\d+)$/
    )
    if (fallbackMatch) {
      return labels.stack(Number.parseInt(fallbackMatch[1] ?? '', 10))
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
  return sourceKey?.startsWith('course:') ? courseLabel : sourceLabel
}
