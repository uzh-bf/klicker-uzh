import {
  DiscussionScopeType,
  type DiscussionScopeInput,
} from '@klicker-uzh/graphql/dist/ops'

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
