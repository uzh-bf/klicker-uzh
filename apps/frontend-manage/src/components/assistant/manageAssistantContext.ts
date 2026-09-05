type QueryValue = string | string[] | undefined

type BuildManageAssistantContextArgs = {
  asPath: string
  locale?: string
  pathname: string
  query: Record<string, QueryValue>
}

export type ManageAssistantSurface =
  | 'question-pool'
  | 'element-editor'
  | 'course-dashboard'
  | 'activity-creation'
  | 'evaluation'
  | 'general'

export type ManageAssistantContext = {
  version: 1
  source: 'manage'
  surface: ManageAssistantSurface
  locale: string
  route: {
    asPath: string
    pathname: string
  }
  ids?: {
    courseId?: string
    elementId?: string
    activityId?: string
    instanceId?: string
    quizId?: string
    templateId?: string
  }
  query?: Record<string, string | string[]>
}

const SENSITIVE_QUERY_KEY_PATTERN =
  /(auth|code|password|secret|session|state|token)/i
const MAX_QUERY_KEYS = 20
const MAX_QUERY_VALUES_PER_KEY = 10
const MAX_QUERY_VALUE_LENGTH = 200
// Must match MAX_ROUTE_LENGTH in apps/chat/src/services/manageContext.ts —
// the chat-side schema rejects (and drops the whole context for) any
// route.asPath longer than this.
const MAX_ASPATH_LENGTH = 512

export function buildManageAssistantContext({
  asPath,
  locale,
  pathname,
  query,
}: BuildManageAssistantContextArgs): ManageAssistantContext {
  const sanitizedQuery = sanitizeQuery(query)
  const ids = extractEntityIds(pathname, sanitizedQuery)
  const sanitizedAsPath = sanitizeAsPath(asPath)

  return {
    version: 1,
    source: 'manage',
    surface: inferManageSurface(pathname),
    locale: locale ?? 'en',
    route: {
      asPath: sanitizedAsPath,
      pathname,
    },
    ...(Object.keys(ids).length > 0 ? { ids } : {}),
    ...(Object.keys(sanitizedQuery).length > 0
      ? { query: sanitizedQuery }
      : {}),
  }
}

export function inferManageSurface(pathname: string): ManageAssistantSurface {
  const normalizedPathname = pathname.toLowerCase()

  if (
    normalizedPathname.startsWith('/analytics') ||
    normalizedPathname.includes('/evaluation') ||
    normalizedPathname.includes('/assessment/results')
  ) {
    return 'evaluation'
  }

  if (
    normalizedPathname.startsWith('/questions/') ||
    normalizedPathname.startsWith('/templates/')
  ) {
    return 'element-editor'
  }

  // The manage index page is the question library itself.
  if (
    normalizedPathname === '/' ||
    normalizedPathname.startsWith('/resources')
  ) {
    return 'question-pool'
  }

  if (normalizedPathname.startsWith('/courses/')) {
    return 'course-dashboard'
  }

  if (
    normalizedPathname.startsWith('/activities') ||
    normalizedPathname.startsWith('/instances/') ||
    normalizedPathname.startsWith('/microlearning/') ||
    normalizedPathname.startsWith('/practicequiz/') ||
    normalizedPathname.startsWith('/quizzes/')
  ) {
    return 'activity-creation'
  }

  return 'general'
}

function sanitizeAsPath(asPath: string) {
  const pathWithoutHash = asPath.split('#')[0] ?? asPath
  const [path = pathWithoutHash, queryString] = pathWithoutHash.split('?')
  const params = new URLSearchParams()
  let appendedKeys = 0

  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => {
      if (appendedKeys >= MAX_QUERY_KEYS) return
      if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) return
      params.append(key, truncateValue(value))
      appendedKeys += 1
    })
  }

  const sanitizedQueryString = params.toString()
  const sanitizedPath = sanitizedQueryString
    ? `${path}?${sanitizedQueryString}`
    : path

  return sanitizedPath.slice(0, MAX_ASPATH_LENGTH)
}

function sanitizeQuery(
  query: Record<string, QueryValue>
): Record<string, string | string[]> {
  const sanitizedEntries = Object.entries(query)
    .filter(([key]) => !SENSITIVE_QUERY_KEY_PATTERN.test(key))
    .slice(0, MAX_QUERY_KEYS)
    .flatMap(([key, value]) => {
      const sanitizedValue = sanitizeQueryValue(value)
      return sanitizedValue === undefined ? [] : [[key, sanitizedValue]]
    })

  return Object.fromEntries(sanitizedEntries)
}

function sanitizeQueryValue(value: QueryValue): string | string[] | undefined {
  if (typeof value === 'string') {
    return truncateValue(value)
  }

  if (Array.isArray(value)) {
    const values = value
      .filter((entry): entry is string => typeof entry === 'string')
      .slice(0, MAX_QUERY_VALUES_PER_KEY)
      .map(truncateValue)
    return values.length > 0 ? values : undefined
  }

  return undefined
}

function truncateValue(value: string) {
  return value.slice(0, MAX_QUERY_VALUE_LENGTH)
}

function extractEntityIds(
  pathname: string,
  query: Record<string, string | string[]>
): NonNullable<ManageAssistantContext['ids']> {
  const normalizedPathname = pathname.toLowerCase()
  const id = getFirstQueryValue(query.id)
  const ids: NonNullable<ManageAssistantContext['ids']> = {
    courseId: getFirstQueryValue(query.courseId),
    quizId: getFirstQueryValue(query.quizId),
  }

  if (!id) {
    return compactIds(ids)
  }

  if (normalizedPathname.startsWith('/questions/')) {
    ids.elementId = id
  } else if (normalizedPathname.startsWith('/templates/')) {
    ids.templateId = id
  } else if (normalizedPathname.startsWith('/instances/')) {
    ids.instanceId = id
  } else if (
    normalizedPathname.startsWith('/analytics') ||
    normalizedPathname.startsWith('/microlearning/') ||
    normalizedPathname.startsWith('/practicequiz/') ||
    normalizedPathname.startsWith('/quizzes/')
  ) {
    ids.activityId = id
  } else if (normalizedPathname.startsWith('/courses/')) {
    ids.courseId = id
  }

  return compactIds(ids)
}

function getFirstQueryValue(value: string | string[] | undefined) {
  if (typeof value === 'string') return value
  return value?.[0]
}

function compactIds(
  ids: NonNullable<ManageAssistantContext['ids']>
): NonNullable<ManageAssistantContext['ids']> {
  return Object.fromEntries(
    Object.entries(ids).filter(([, value]) => typeof value === 'string')
  )
}
