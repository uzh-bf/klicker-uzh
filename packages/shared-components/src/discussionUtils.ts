export type ParsedDiscussionScopeInput = {
  scopeType:
    | 'COURSE'
    | 'PRACTICE_QUIZ'
    | 'PRACTICE_STACK'
    | 'PRACTICE_ELEMENT'
    | 'LIVE_QUIZ'
    | 'LIVE_BLOCK'
    | 'LIVE_INSTANCE'
    | 'EXTERNAL_BLOCK'
  practiceQuizId?: string
  stackId?: number
  instanceId?: number
  liveBlockId?: number
  externalSource?: string
  externalRef?: string
}

export function parseScopeKeyToInput(
  courseId: string,
  scopeKey?: string | null
): ParsedDiscussionScopeInput {
  if (!scopeKey || scopeKey === `course:${courseId}`) {
    return { scopeType: 'COURSE' }
  }

  const practiceElementMatch = scopeKey.match(
    /^pq:([^:]+):stack:(\d+):instance:(\d+)$/
  )
  if (practiceElementMatch) {
    return {
      scopeType: 'PRACTICE_ELEMENT',
      practiceQuizId: practiceElementMatch[1],
      stackId: Number.parseInt(practiceElementMatch[2] ?? '', 10),
      instanceId: Number.parseInt(practiceElementMatch[3] ?? '', 10),
    }
  }

  const practiceStackMatch = scopeKey.match(/^pq:([^:]+):stack:(\d+)$/)
  if (practiceStackMatch) {
    return {
      scopeType: 'PRACTICE_STACK',
      practiceQuizId: practiceStackMatch[1],
      stackId: Number.parseInt(practiceStackMatch[2] ?? '', 10),
    }
  }

  const practiceQuizMatch = scopeKey.match(/^pq:([^:]+)$/)
  if (practiceQuizMatch) {
    return {
      scopeType: 'PRACTICE_QUIZ',
      practiceQuizId: practiceQuizMatch[1],
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

  const liveInstanceMatch = scopeKey.match(
    /^lq:([^:]+):block:(\d+):instance:(\d+)$/
  )
  if (liveInstanceMatch) {
    return {
      scopeType: 'LIVE_INSTANCE',
      liveBlockId: Number.parseInt(liveInstanceMatch[2] ?? '', 10),
      instanceId: Number.parseInt(liveInstanceMatch[3] ?? '', 10),
    }
  }

  const liveBlockMatch = scopeKey.match(/^lq:([^:]+):block:(\d+)$/)
  if (liveBlockMatch) {
    return {
      scopeType: 'LIVE_BLOCK',
      liveBlockId: Number.parseInt(liveBlockMatch[2] ?? '', 10),
    }
  }

  const liveQuizMatch = scopeKey.match(/^lq:([^:]+)$/)
  if (liveQuizMatch) {
    return { scopeType: 'LIVE_QUIZ' }
  }

  return { scopeType: 'COURSE' }
}
