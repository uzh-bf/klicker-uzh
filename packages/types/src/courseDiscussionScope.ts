export type ParsedCourseDiscussionScopeKey =
  | {
      kind: 'course'
      courseId: string
    }
  | {
      kind: 'practiceStack'
      stackId: number
    }
  | {
      kind: 'externalBlock'
      externalSource: string
      externalRef: string
    }

export function buildCourseDiscussionScopeKey(courseId: string) {
  if (!courseId) throw new Error('Course discussion scope requires a course ID')

  return `course:${courseId}`
}

export function buildPracticeStackDiscussionScopeKey(stackId: number) {
  if (
    !Number.isSafeInteger(stackId) ||
    stackId <= 0 ||
    stackId > 2_147_483_647
  ) {
    throw new Error('Course discussion scope requires a valid stack ID')
  }

  return `stack:${stackId}`
}

export function buildExternalBlockDiscussionScopeKey(
  externalSource: string,
  externalRef: string
) {
  if (!externalSource || !externalRef) {
    throw new Error('External discussion scope requires source and reference')
  }

  return `ext:${encodeURIComponent(externalSource)}:${encodeURIComponent(externalRef)}`
}

export function parseCourseDiscussionScopeKey(
  scopeKey: string
): ParsedCourseDiscussionScopeKey | null {
  const courseMatch = scopeKey.match(/^course:(.+)$/)
  if (courseMatch) {
    return {
      kind: 'course',
      courseId: courseMatch[1] ?? '',
    }
  }

  const stackMatch = scopeKey.match(/^stack:([1-9]\d*)$/)
  if (stackMatch) {
    const stackId = Number.parseInt(stackMatch[1] ?? '', 10)
    if (!Number.isSafeInteger(stackId) || stackId > 2_147_483_647) return null

    return {
      kind: 'practiceStack',
      stackId,
    }
  }

  const externalMatch = scopeKey.match(/^ext:([^:]+):(.+)$/)
  if (!externalMatch) return null

  try {
    const externalSource = decodeURIComponent(externalMatch[1] ?? '')
    const externalRef = decodeURIComponent(externalMatch[2] ?? '')

    if (!externalSource || !externalRef) return null

    return {
      kind: 'externalBlock',
      externalSource,
      externalRef,
    }
  } catch {
    return null
  }
}
