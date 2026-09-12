import { z } from 'zod'
import type { LecturerMcpSession } from './auth.js'
import {
  LecturerMcpAuthorizationError,
  requireDerivedPermission,
  type LecturerDerivedPermission,
  type LecturerPermissionLevel,
} from './authorization.js'

const MAX_COURSES = 20
const MAX_ELEMENTS = 10
const SEARCH_SNIPPET_CHARS = 500
const DETAIL_CONTENT_CHARS = 4000
const DETAIL_EXPLANATION_CHARS = 2000
const DETAIL_OPTIONS_CHARS = 4000

const permissionLevelSchema = z.enum([
  'READ',
  'EXECUTE',
  'WRITE',
  'ADMIN',
  'OWNER',
])

const elementTypeSchema = z.enum([
  'SC',
  'MC',
  'KPRIM',
  'FREE_TEXT',
  'NUMERICAL',
  'CONTENT',
  'FLASHCARD',
  'SELECTION',
  'CASE_STUDY',
])

const elementStatusSchema = z.enum(['DRAFT', 'REVIEW', 'READY'])

export const courseListSchema = z.object({
  includeArchived: z
    .boolean()
    .default(false)
    .describe('Include archived courses in the results. Defaults to false.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_COURSES)
    .default(10)
    .describe(`Maximum number of courses to return (1-${MAX_COURSES}).`),
  query: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .describe(
      'Optional case-insensitive substring to match against the course name, e.g. "statistics". Omit to list all accessible courses.'
    ),
})

export const courseGetSchema = z.object({
  courseId: z
    .string()
    .uuid()
    .describe('Readable course id (uuid) to fetch details for.'),
})

export const elementSearchSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_ELEMENTS)
    .default(5)
    .describe(`Maximum number of elements to return (1-${MAX_ELEMENTS}).`),
  query: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .describe(
      'Optional case-insensitive substring to match against element name or content, e.g. "standard deviation". Omit to list recent elements.'
    ),
  status: elementStatusSchema
    .optional()
    .describe('Optional status filter: DRAFT, REVIEW, or READY.'),
  type: elementTypeSchema
    .optional()
    .describe('Optional element type filter, e.g. SC or NUMERICAL.'),
})

export const elementGetSchema = z.object({
  elementId: z
    .number()
    .int()
    .positive()
    .describe('Readable element id (positive integer) to fetch details for.'),
})

export const questionDraftSchema = z.object({
  courseId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional readable course id to associate with the draft.'),
  difficulty: z
    .enum(['introductory', 'intermediate', 'advanced'])
    .optional()
    .describe('Optional intended difficulty, e.g. intermediate.'),
  learningObjective: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .optional()
    .describe('Optional learning objective, e.g. Interpret a histogram.'),
  topic: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .describe('Topic for the draft question, e.g. standard deviation.'),
  type: z
    .enum(['SC', 'MC', 'FREE_TEXT'])
    .default('SC')
    .describe('Question type to scaffold: SC, MC, or FREE_TEXT.'),
})

export const choicesDraftSchema = z.object({
  correctAnswer: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .optional()
    .describe('Optional correct answer, e.g. The spread around the mean.'),
  distractorCount: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(3)
    .describe('Number of distractors to scaffold, between 1 and 5.'),
  question: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe('Question text that needs answer choices.'),
})

export const feedbackDraftSchema = z.object({
  choices: z
    .array(z.string().trim().min(1).max(240))
    .min(1)
    .max(8)
    .describe(
      'Answer choices to scaffold feedback for; first is treated as correct.'
    ),
  question: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe('Question text that needs answer feedback.'),
})

const proposalChoiceSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().trim().min(1).max(500).optional(),
  value: z.string().trim().min(1).max(240),
})

export const elementCreateDraftProposalSchema = z
  .object({
    choices: z.array(proposalChoiceSchema).min(2).max(8).optional(),
    content: z.string().trim().min(1).max(4000),
    explanation: z.string().trim().min(1).max(2000).optional(),
    name: z.string().trim().min(1).max(160),
    tags: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
    type: z.enum(['SC', 'MC', 'FREE_TEXT']),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'FREE_TEXT') return

    const choices = value.choices ?? []
    if (choices.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SC and MC proposals require at least two choices',
        path: ['choices'],
      })
      return
    }

    const correctCount = choices.filter((choice) => choice.correct).length
    if (value.type === 'SC' && correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SC proposals require exactly one correct choice',
        path: ['choices'],
      })
    }
    if (value.type === 'MC' && correctCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MC proposals require at least one correct choice',
        path: ['choices'],
      })
    }
  })

type CourseListInput = z.infer<typeof courseListSchema>
type CourseGetInput = z.infer<typeof courseGetSchema>
type ElementSearchInput = z.infer<typeof elementSearchSchema>
type ElementGetInput = z.infer<typeof elementGetSchema>
type QuestionDraftInput = z.infer<typeof questionDraftSchema>
type ChoicesDraftInput = z.infer<typeof choicesDraftSchema>
type FeedbackDraftInput = z.infer<typeof feedbackDraftSchema>
type ElementCreateDraftProposalInput = z.infer<
  typeof elementCreateDraftProposalSchema
>

type DateValue = Date | string | null | undefined

type PermissionRow = LecturerDerivedPermission & {
  derived?: boolean
}

type CourseRow = {
  color: string
  description?: string | null
  displayName: string
  endDate: DateValue
  id: string
  isArchived: boolean
  language: string
  name: string
  startDate: DateValue
  updatedAt: DateValue
}

type CourseDetailRow = CourseRow & {
  _count?: {
    groupActivities?: number
    liveQuizzes?: number
    microLearnings?: number
    practiceQuizzes?: number
  }
  permissions?: PermissionRow[]
}

type ElementRow = {
  content: string
  id: number
  name: string
  status: string
  tags?: TagRow[]
  type: string
  updatedAt: DateValue
}

type ElementDetailRow = ElementRow & {
  explanation?: string | null
  options: unknown
  permissions?: PermissionRow[]
}

type DerivedCourseRow = PermissionRow & {
  course?: CourseRow | null
}

type DerivedElementRow = PermissionRow & {
  element?: ElementRow | null
}

type TagRow = {
  id: number
  name: string
}

export type LecturerPrisma = {
  course: {
    findFirst: (args: any) => Promise<CourseDetailRow | null>
  }
  derivedPermission: {
    findMany: (
      args: any
    ) => Promise<Array<DerivedCourseRow | DerivedElementRow>>
  }
  element: {
    findFirst: (args: any) => Promise<ElementDetailRow | null>
  }
}

export type LecturerReadService = {
  createElementDraftProposal: (
    input: unknown,
    session: LecturerMcpSession
  ) => ElementCreateDraftProposalOutput
  createChoicesDraft: (
    input: unknown,
    session: LecturerMcpSession
  ) => ChoicesDraftOutput
  createFeedbackDraft: (
    input: unknown,
    session: LecturerMcpSession
  ) => FeedbackDraftOutput
  createQuestionDraft: (
    input: unknown,
    session: LecturerMcpSession
  ) => Promise<QuestionDraftOutput>
  getCourse: (
    input: unknown,
    session: LecturerMcpSession
  ) => Promise<CourseGetOutput>
  getElement: (
    input: unknown,
    session: LecturerMcpSession
  ) => Promise<ElementGetOutput>
  listCourses: (
    input: unknown,
    session: LecturerMcpSession
  ) => Promise<CourseListOutput>
  searchElements: (
    input: unknown,
    session: LecturerMcpSession
  ) => Promise<ElementSearchOutput>
}

type CourseSummary = {
  color: string
  descriptionSnippet: string | null
  displayName: string
  endDate: string | null
  id: string
  isArchived: boolean
  language: string
  name: string
  permissionLevel: LecturerPermissionLevel
  startDate: string | null
  updatedAt: string | null
}

type CourseListOutput = {
  courses: CourseSummary[]
}

type CourseGetOutput = {
  course: CourseSummary & {
    activityCounts: {
      groupActivities: number
      liveQuizzes: number
      microLearnings: number
      practiceQuizzes: number
    }
  }
}

type ElementSummary = {
  id: number
  name: string
  permissionLevel: LecturerPermissionLevel
  snippet: string
  status: string
  tags: TagRow[]
  type: string
  updatedAt: string | null
}

type ElementSearchOutput = {
  elements: ElementSummary[]
  hasMore: boolean
}

type ElementGetOutput = {
  element: ElementSummary & {
    content: string
    explanation: string | null
    options: unknown
  }
}

type QuestionDraftOutput = {
  kind: 'question.draft'
  requiresConfirmation: false
  payload: {
    courseId?: string
    name: string
    type: QuestionDraftInput['type']
    status: 'DRAFT'
    content: string
    options: unknown
  }
}

type ChoicesDraftOutput = {
  kind: 'choices.draft'
  requiresConfirmation: false
  payload: {
    question: string
    choices: Array<{
      correct: boolean
      value: string
    }>
  }
}

type FeedbackDraftOutput = {
  kind: 'feedback.draft'
  requiresConfirmation: false
  payload: {
    question: string
    feedback: Array<{
      choice: string
      feedback: string
    }>
  }
}

type ElementCreateDraftProposalOutput = {
  kind: 'element.create.proposal'
  requiresConfirmation: true
  summary: string
  payload: {
    basePoints: true
    content: string
    explanation?: string
    name: string
    options: unknown
    pointsMultiplier: 1
    status: 'DRAFT'
    tags: string[]
    type: ElementCreateDraftProposalInput['type']
  }
}

function toIso(value: DateValue): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function stripHtml(value: string): string {
  let output = ''
  let insideTag = false

  for (const char of value) {
    if (char === '<') {
      insideTag = true
      output += ' '
      continue
    }

    if (insideTag) {
      if (char === '>') {
        insideTag = false
      }
      continue
    }

    output += char
  }

  return output
}

function compactPlainText(value: string | null | undefined): string {
  return stripHtml(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(value: string | null | undefined, maxChars: number) {
  const text = compactPlainText(value)
  if (!text) return ''
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`
}

function optionalSnippet(value: string | null | undefined, maxChars: number) {
  const text = truncateText(value, maxChars)
  return text || null
}

// Prisma `contains` is a literal substring match, so glob/regex sentinels a
// model might pass to mean "everything" (`*`, `.*`, `.+`, `%`) would instead
// filter to rows literally containing those characters and surface nothing.
// Treat a query made up only of such wildcards or whitespace as "no filter".
function normalizeQuery(query: string | undefined): string | undefined {
  if (!query) return undefined
  const trimmed = query.trim()
  if (trimmed.length === 0) return undefined
  if (/^[\s.*+%]+$/.test(trimmed)) return undefined
  return trimmed
}

function cappedJson(value: unknown): unknown {
  const serialized = JSON.stringify(value ?? null)
  if (serialized.length <= DETAIL_OPTIONS_CHARS) {
    return value ?? null
  }

  return {
    jsonPreview: truncateText(serialized, DETAIL_OPTIONS_CHARS),
    truncated: true,
  }
}

function asPermission(permission: PermissionRow | undefined) {
  if (!permission) return null

  return {
    permissionLevel: permissionLevelSchema.parse(permission.permissionLevel),
    userId: permission.userId,
  }
}

function courseSummary(
  course: CourseRow,
  permissionLevel: LecturerPermissionLevel
): CourseSummary {
  return {
    color: course.color,
    descriptionSnippet: optionalSnippet(
      course.description,
      SEARCH_SNIPPET_CHARS
    ),
    displayName: course.displayName,
    endDate: toIso(course.endDate),
    id: course.id,
    isArchived: course.isArchived,
    language: course.language,
    name: course.displayName || course.name,
    permissionLevel,
    startDate: toIso(course.startDate),
    updatedAt: toIso(course.updatedAt),
  }
}

function elementSummary(
  element: ElementRow,
  permissionLevel: LecturerPermissionLevel
): ElementSummary {
  return {
    id: element.id,
    name: element.name,
    permissionLevel,
    snippet: truncateText(element.content, SEARCH_SNIPPET_CHARS),
    status: element.status,
    tags: element.tags ?? [],
    type: element.type,
    updatedAt: toIso(element.updatedAt),
  }
}

function permissionOrDeny(
  permission: PermissionRow | undefined,
  userId: string
) {
  return requireDerivedPermission({
    permission: asPermission(permission),
    requiredPermissionLevel: 'READ',
    userId,
  })
}

function inaccessible(): never {
  throw new LecturerMcpAuthorizationError('Object not found or not accessible')
}

function getDefaultQuestionOptions(type: QuestionDraftInput['type']) {
  if (type === 'FREE_TEXT') {
    return {
      hasSampleSolution: false,
      restrictions: {},
    }
  }

  return {
    choices: [],
    displayMode: 'LIST',
    hasAnswerFeedbacks: false,
    hasSampleSolution: false,
  }
}

function formatQuestionType(type: QuestionDraftInput['type']) {
  if (type === 'SC') return 'single-choice'
  if (type === 'MC') return 'multiple-choice'
  return 'free-text'
}

function getProposalOptions(args: ElementCreateDraftProposalInput) {
  if (args.type === 'FREE_TEXT') {
    return {
      hasSampleSolution: false,
      restrictions: {},
    }
  }

  const choices = args.choices ?? []
  const hasAnswerFeedbacks = choices.some((choice) => Boolean(choice.feedback))

  return {
    choices: choices.map((choice, ix) => ({
      ix,
      correct: choice.correct,
      feedback: choice.feedback,
      value: choice.value,
    })),
    displayMode: 'LIST',
    hasAnswerFeedbacks,
    hasSampleSolution: true,
  }
}

export function createLecturerReadService(
  prisma: LecturerPrisma
): LecturerReadService {
  const service: LecturerReadService = {
    createElementDraftProposal(input) {
      const args: ElementCreateDraftProposalInput =
        elementCreateDraftProposalSchema.parse(input)

      return {
        kind: 'element.create.proposal',
        payload: {
          basePoints: true,
          content: args.content,
          ...(args.explanation ? { explanation: args.explanation } : {}),
          name: args.name,
          options: getProposalOptions(args),
          pointsMultiplier: 1,
          status: 'DRAFT',
          tags: args.tags,
          type: args.type,
        },
        requiresConfirmation: true,
        summary: `Create DRAFT ${args.type} question "${args.name}"`,
      }
    },

    async createQuestionDraft(input, session) {
      const args: QuestionDraftInput = questionDraftSchema.parse(input)
      if (args.courseId) {
        await service.getCourse({ courseId: args.courseId }, session)
      }

      const objective = args.learningObjective
        ? `\n\nLearning objective: ${args.learningObjective}`
        : ''
      const difficulty = args.difficulty
        ? `\nDifficulty: ${args.difficulty}`
        : ''

      return {
        kind: 'question.draft',
        requiresConfirmation: false,
        payload: {
          ...(args.courseId ? { courseId: args.courseId } : {}),
          content: `Draft a ${formatQuestionType(args.type)} question about ${args.topic}.${objective}${difficulty}`,
          name: args.topic,
          options: getDefaultQuestionOptions(args.type),
          status: 'DRAFT',
          type: args.type,
        },
      }
    },

    createChoicesDraft(input) {
      const args: ChoicesDraftInput = choicesDraftSchema.parse(input)
      const choices = [
        {
          correct: true,
          value:
            args.correctAnswer ??
            'A concise answer that directly addresses the question.',
        },
        ...Array.from({ length: args.distractorCount }, (_, index) => ({
          correct: false,
          value: `Plausible distractor ${index + 1}`,
        })),
      ]

      return {
        kind: 'choices.draft',
        requiresConfirmation: false,
        payload: {
          choices,
          question: args.question,
        },
      }
    },

    createFeedbackDraft(input) {
      const args: FeedbackDraftInput = feedbackDraftSchema.parse(input)

      return {
        kind: 'feedback.draft',
        requiresConfirmation: false,
        payload: {
          feedback: args.choices.map((choice, index) => ({
            choice,
            feedback:
              index === 0
                ? 'Use this feedback to reinforce why this answer is correct.'
                : 'Use this feedback to address the misconception behind this answer.',
          })),
          question: args.question,
        },
      }
    },

    async listCourses(input, session) {
      const args: CourseListInput = courseListSchema.parse(input ?? {})
      const query = normalizeQuery(args.query)
      const rows = (await prisma.derivedPermission.findMany({
        include: {
          course: {
            select: {
              color: true,
              description: true,
              displayName: true,
              endDate: true,
              id: true,
              isArchived: true,
              language: true,
              name: true,
              startDate: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [{ course: { endDate: 'desc' } }],
        take: args.limit,
        where: {
          course: {
            ...(args.includeArchived ? {} : { isArchived: false }),
            ...(query
              ? {
                  OR: [
                    {
                      displayName: {
                        contains: query,
                        mode: 'insensitive',
                      },
                    },
                    {
                      name: {
                        contains: query,
                        mode: 'insensitive',
                      },
                    },
                  ],
                }
              : {}),
          },
          courseId: { not: null },
          userId: session.userId,
        },
      })) as DerivedCourseRow[]

      return {
        courses: rows.flatMap((row) => {
          if (!row.course) return []
          const permission = permissionOrDeny(row, session.userId)
          return [courseSummary(row.course, permission.permissionLevel)]
        }),
      }
    },

    async getCourse(input, session) {
      const args: CourseGetInput = courseGetSchema.parse(input)
      const course = await prisma.course.findFirst({
        select: {
          _count: {
            select: {
              groupActivities: true,
              liveQuizzes: true,
              microLearnings: true,
              practiceQuizzes: true,
            },
          },
          color: true,
          description: true,
          displayName: true,
          endDate: true,
          id: true,
          isArchived: true,
          language: true,
          name: true,
          permissions: {
            take: 1,
            where: { userId: session.userId },
          },
          startDate: true,
          updatedAt: true,
        },
        where: {
          id: args.courseId,
          permissions: { some: { userId: session.userId } },
        },
      })

      if (!course) inaccessible()
      const permission = permissionOrDeny(
        course.permissions?.[0],
        session.userId
      )

      return {
        course: {
          ...courseSummary(course, permission.permissionLevel),
          activityCounts: {
            groupActivities: course._count?.groupActivities ?? 0,
            liveQuizzes: course._count?.liveQuizzes ?? 0,
            microLearnings: course._count?.microLearnings ?? 0,
            practiceQuizzes: course._count?.practiceQuizzes ?? 0,
          },
        },
      }
    },

    async searchElements(input, session) {
      const args: ElementSearchInput = elementSearchSchema.parse(input ?? {})
      const query = normalizeQuery(args.query)
      const rows = (await prisma.derivedPermission.findMany({
        include: {
          element: {
            select: {
              content: true,
              id: true,
              name: true,
              status: true,
              tags: {
                orderBy: { order: 'asc' },
                select: { id: true, name: true },
                where: { ownerId: session.userId },
              },
              type: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [{ element: { updatedAt: 'desc' } }],
        take: args.limit + 1,
        where: {
          element: {
            isArchived: false,
            isDeleted: false,
            ...(args.status ? { status: args.status } : {}),
            ...(args.type ? { type: args.type } : {}),
            ...(query
              ? {
                  OR: [
                    {
                      name: {
                        contains: query,
                        mode: 'insensitive',
                      },
                    },
                    {
                      content: {
                        contains: query,
                        mode: 'insensitive',
                      },
                    },
                  ],
                }
              : {}),
          },
          elementId: { not: null },
          userId: session.userId,
        },
      })) as DerivedElementRow[]

      const limitedRows = rows.slice(0, args.limit)

      return {
        elements: limitedRows.flatMap((row) => {
          if (!row.element) return []
          const permission = permissionOrDeny(row, session.userId)
          return [elementSummary(row.element, permission.permissionLevel)]
        }),
        hasMore: rows.length > args.limit,
      }
    },

    async getElement(input, session) {
      const args: ElementGetInput = elementGetSchema.parse(input)
      const element = await prisma.element.findFirst({
        select: {
          content: true,
          explanation: true,
          id: true,
          name: true,
          options: true,
          permissions: {
            take: 1,
            where: { userId: session.userId },
          },
          status: true,
          tags: {
            orderBy: { order: 'asc' },
            select: { id: true, name: true },
            where: { ownerId: session.userId },
          },
          type: true,
          updatedAt: true,
        },
        where: {
          id: args.elementId,
          isArchived: false,
          isDeleted: false,
          permissions: { some: { userId: session.userId } },
        },
      })

      if (!element) inaccessible()
      const permission = permissionOrDeny(
        element.permissions?.[0],
        session.userId
      )

      return {
        element: {
          ...elementSummary(element, permission.permissionLevel),
          content: truncateText(element.content, DETAIL_CONTENT_CHARS),
          explanation: optionalSnippet(
            element.explanation,
            DETAIL_EXPLANATION_CHARS
          ),
          options: cappedJson(element.options),
        },
      }
    },
  }

  return service
}
