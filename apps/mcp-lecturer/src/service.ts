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
  includeArchived: z.boolean().default(false),
  limit: z.number().int().min(1).max(MAX_COURSES).default(10),
  query: z.string().trim().min(1).max(120).optional(),
})

export const courseGetSchema = z.object({
  courseId: z.string().uuid(),
})

export const elementSearchSchema = z.object({
  limit: z.number().int().min(1).max(MAX_ELEMENTS).default(5),
  query: z.string().trim().min(1).max(120).optional(),
  status: elementStatusSchema.optional(),
  type: elementTypeSchema.optional(),
})

export const elementGetSchema = z.object({
  elementId: z.number().int().positive(),
})

type CourseListInput = z.infer<typeof courseListSchema>
type CourseGetInput = z.infer<typeof courseGetSchema>
type ElementSearchInput = z.infer<typeof elementSearchSchema>
type ElementGetInput = z.infer<typeof elementGetSchema>

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

function toIso(value: DateValue): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ')
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

export function createLecturerReadService(
  prisma: LecturerPrisma
): LecturerReadService {
  return {
    async listCourses(input, session) {
      const args: CourseListInput = courseListSchema.parse(input ?? {})
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
            ...(args.query
              ? {
                  OR: [
                    {
                      displayName: {
                        contains: args.query,
                        mode: 'insensitive',
                      },
                    },
                    {
                      name: {
                        contains: args.query,
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
            ...(args.query
              ? {
                  OR: [
                    {
                      name: {
                        contains: args.query,
                        mode: 'insensitive',
                      },
                    },
                    {
                      content: {
                        contains: args.query,
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
}
