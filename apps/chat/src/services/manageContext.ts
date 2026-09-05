import { z } from 'zod'

const MAX_ROUTE_LENGTH = 512
const MAX_QUERY_KEYS = 20
const MAX_QUERY_VALUE_LENGTH = 200
const MAX_QUERY_VALUES_PER_KEY = 10
const SENSITIVE_QUERY_KEY_PATTERN =
  /(auth|code|password|secret|session|state|token)/i

const manageSurfaceSchema = z.enum([
  'question-pool',
  'element-editor',
  'course-dashboard',
  'activity-creation',
  'evaluation',
  'general',
])

const queryValueSchema = z.union([
  z.string().max(MAX_QUERY_VALUE_LENGTH),
  z.array(z.string().max(MAX_QUERY_VALUE_LENGTH)).max(MAX_QUERY_VALUES_PER_KEY),
])

const querySchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const query = value as Record<string, unknown>
  const entries: [string, unknown][] = []
  for (const key in query) {
    if (!Object.prototype.hasOwnProperty.call(query, key)) continue
    if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) continue

    entries.push([key, query[key]])
    if (entries.length >= MAX_QUERY_KEYS) break
  }

  return Object.fromEntries(entries)
}, z.record(queryValueSchema))

// Mirrors the query-key filtering above: route.asPath is a raw string (not
// parsed query params), so a caller could otherwise smuggle sensitive values
// through the path itself.
function sanitizeAsPath(asPath: string) {
  const [path = asPath, queryString] = asPath.split('?')
  if (!queryString) return path

  const params = new URLSearchParams()
  let appendedKeys = 0
  new URLSearchParams(queryString).forEach((value, key) => {
    if (appendedKeys >= MAX_QUERY_KEYS) return
    if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) return
    params.append(key, value.slice(0, MAX_QUERY_VALUE_LENGTH))
    appendedKeys += 1
  })

  const sanitizedQueryString = params.toString()
  return sanitizedQueryString ? `${path}?${sanitizedQueryString}` : path
}

const manageContextSchema = z.object({
  version: z.literal(1),
  source: z.literal('manage'),
  surface: manageSurfaceSchema,
  locale: z.string().min(2).max(16),
  route: z.object({
    asPath: z
      .string()
      .min(1)
      .max(MAX_ROUTE_LENGTH)
      .transform((asPath) => sanitizeAsPath(asPath)),
    pathname: z.string().min(1).max(MAX_ROUTE_LENGTH),
  }),
  ids: z
    .object({
      courseId: z.string().min(1).max(128).optional(),
      elementId: z.string().min(1).max(128).optional(),
      activityId: z.string().min(1).max(128).optional(),
      instanceId: z.string().min(1).max(128).optional(),
      quizId: z.string().min(1).max(128).optional(),
      templateId: z.string().min(1).max(128).optional(),
    })
    .optional(),
  query: querySchema.optional(),
})

export type ManageAssistantContext = z.infer<typeof manageContextSchema>

export function sanitizeManageAssistantContext(
  value: unknown
): ManageAssistantContext | null {
  const parsed = manageContextSchema.safeParse(value)
  if (!parsed.success) return null
  return parsed.data
}

export function getManageContextLabel(
  context: ManageAssistantContext | null,
  labels?: ManageContextLabels
): string | null {
  if (!context) return null

  const surfaceLabel =
    labels?.surfaces[context.surface] ?? getSurfaceLabel(context.surface)
  if (context.ids?.courseId) {
    return `${surfaceLabel} - ${
      labels?.entities.course(context.ids.courseId) ??
      `Course ${context.ids.courseId}`
    }`
  }

  if (context.ids?.activityId) {
    return `${surfaceLabel} - ${
      labels?.entities.activity(context.ids.activityId) ??
      `Activity ${context.ids.activityId}`
    }`
  }

  if (context.ids?.elementId) {
    return `${surfaceLabel} - ${
      labels?.entities.question(context.ids.elementId) ??
      `Question ${context.ids.elementId}`
    }`
  }

  return surfaceLabel
}

export type ManageContextLabels = {
  surfaces: Record<ManageAssistantContext['surface'], string>
  entities: {
    course: (id: string) => string
    activity: (id: string) => string
    question: (id: string) => string
  }
}

export function formatManageContextForPrompt(
  context: ManageAssistantContext | null
) {
  if (!context) return ''

  const lines = [
    'Current KlickerUZH Manage context. This context contains only route metadata and sanitized identifiers.',
    `Surface: ${context.surface}`,
    `Route: ${context.route.pathname}`,
  ]

  if (context.ids?.courseId) {
    lines.push(`Course ID: ${context.ids.courseId}`)
  }
  if (context.ids?.activityId) {
    lines.push(`Activity ID: ${context.ids.activityId}`)
  }
  if (context.ids?.elementId) {
    lines.push(`Question ID: ${context.ids.elementId}`)
  }
  if (context.ids?.templateId) {
    lines.push(`Template ID: ${context.ids.templateId}`)
  }
  if (context.ids?.instanceId) {
    lines.push(`Instance ID: ${context.ids.instanceId}`)
  }
  if (context.ids?.quizId) {
    lines.push(`Quiz ID: ${context.ids.quizId}`)
  }

  return lines.join('\n')
}

function getSurfaceLabel(surface: ManageAssistantContext['surface']) {
  switch (surface) {
    case 'question-pool':
      return 'Question pool'
    case 'element-editor':
      return 'Question editor'
    case 'course-dashboard':
      return 'Course dashboard'
    case 'activity-creation':
      return 'Activity setup'
    case 'evaluation':
      return 'Evaluation'
    case 'general':
      return 'Manage'
  }
}
