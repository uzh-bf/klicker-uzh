export type ParsedDiscussionScopeInput = {
  scopeType: 'COURSE' | 'PRACTICE_STACK' | 'EXTERNAL_BLOCK'
  stackId?: number
  externalSource?: string
  externalRef?: string
}

export function parseScopeKeyToInput(
  courseId: string,
  scopeKey?: string | null
): ParsedDiscussionScopeInput | null {
  if (!scopeKey || scopeKey === `course:${courseId}`) {
    return { scopeType: 'COURSE' }
  }

  const practiceStackMatch = scopeKey.match(/^stack:(\d+)$/)
  if (practiceStackMatch) {
    return {
      scopeType: 'PRACTICE_STACK',
      stackId: Number.parseInt(practiceStackMatch[1] ?? '', 10),
    }
  }

  const externalMatch = scopeKey.match(/^ext:([^:]+):(.+)$/)
  if (externalMatch) {
    return {
      scopeType: 'EXTERNAL_BLOCK',
      externalSource: decodeURIComponent(externalMatch[1] ?? ''),
      externalRef: decodeURIComponent(externalMatch[2] ?? ''),
    }
  }
  return null
}
