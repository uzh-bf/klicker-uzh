import * as DB from '@klicker-uzh/prisma/client'
import type { ElementOptionsChoices } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import {
  getLecturerRatingFamilyKey,
  selectLecturerRatingFamilies,
} from './lecturerRatingSampler.js'
import { checkAccess } from './sharing.js'

export const LECTURER_RATING_BLOOM_LEVELS = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
] as const

export type LecturerRatingBloomLevel =
  (typeof LECTURER_RATING_BLOOM_LEVELS)[number]
export type LecturerRatingFormat = 'SC' | 'KPRIM'

export interface LecturerRatingCourse {
  id: string
  name: string
}

export interface LecturerRatingChoice {
  text: string
  correct: boolean
}

export interface LecturerRatingItem {
  id: string
  format: string
  position: number
  elementVersion: number
  ratingVersion: string
  title: string
  stem: string
  choices: LecturerRatingChoice[]
  difficulty: number | null
  bloom: string | null
  reviewed: boolean
  unavailable: boolean
}

export interface LecturerRatingSession {
  id: string
  courseId: string
  items: LecturerRatingItem[]
}

type LecturerRatingCandidate = {
  id: number
  format: LecturerRatingFormat
  version: number
  originalId: string | null
  title: string
  stem: string
  choices: LecturerRatingChoice[]
  tags: string[]
}

function graphQLError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}

function isPrismaError(error: unknown, code: 'P2002' | 'P2034'): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

export function readLecturerRatingCourseIds(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const serialized = env.LECTURER_RATING_COURSE_IDS_JSON
  if (!serialized) return []

  try {
    const parsed = JSON.parse(serialized) as unknown
    if (
      !Array.isArray(parsed) ||
      !parsed.every((value) => typeof value === 'string')
    ) {
      return []
    }

    return Array.from(
      new Set(parsed.map((value) => value.trim()).filter(Boolean))
    ).sort((left, right) => left.localeCompare(right, 'en'))
  } catch {
    return []
  }
}

function getQuestionFormat(type: DB.ElementType): LecturerRatingFormat | null {
  if (type === DB.ElementType.SC) return 'SC'
  if (type === DB.ElementType.KPRIM) return 'KPRIM'
  return null
}

function projectChoices(
  options: DB.Element['options'],
  format: LecturerRatingFormat
): LecturerRatingChoice[] | null {
  const projectedOptions = options as Partial<ElementOptionsChoices>
  if (projectedOptions?.hasSampleSolution !== true) return null

  const choices = projectedOptions.choices
  if (!Array.isArray(choices) || choices.length < 2) return null

  const projected = choices.map((choice) => ({
    text: choice.value,
    correct: format === 'SC' ? choice.correct === true : choice.correct,
  }))
  if (
    projected.some(
      (choice) =>
        typeof choice.text !== 'string' || typeof choice.correct !== 'boolean'
    )
  ) {
    return null
  }

  const correctChoiceCount = projected.filter((choice) => choice.correct).length
  if (
    (format === 'SC' && correctChoiceCount !== 1) ||
    (format === 'KPRIM' && projected.length !== 4)
  ) {
    return null
  }

  return projected as LecturerRatingChoice[]
}

function toCandidate(element: {
  id: number
  version: number
  originalId: string | null
  name: string
  content: string
  options: DB.Element['options']
  type: DB.ElementType
  tags: Array<{ name: string }>
}): LecturerRatingCandidate | null {
  const format = getQuestionFormat(element.type)
  const choices = format ? projectChoices(element.options, format) : null
  if (!format || !choices) return null

  return {
    id: element.id,
    format,
    version: element.version,
    originalId: element.originalId,
    title: element.name,
    stem: element.content,
    choices,
    tags: Array.from(new Set(element.tags.map((tag) => tag.name))).sort(
      (left, right) => left.localeCompare(right, 'en')
    ),
  }
}

async function assertConfiguredCourseManager(
  courseId: string,
  ctx: ContextWithUser | PrismaTransactionContextWithUser
): Promise<void> {
  if (!readLecturerRatingCourseIds().includes(courseId)) {
    throw graphQLError(
      'Lecturer rating is not enabled for this course',
      'LECTURER_RATING_COURSE_NOT_CONFIGURED'
    )
  }

  const hasAccess = await checkAccess(
    [
      {
        courseId,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      },
    ],
    ctx
  )
  if (!hasAccess) {
    throw graphQLError(
      'Course manager access is required for lecturer rating',
      'LECTURER_RATING_FORBIDDEN'
    )
  }
}

export async function lecturerRatingCourses(
  ctx: ContextWithUser
): Promise<LecturerRatingCourse[]> {
  const courseIds = readLecturerRatingCourseIds()
  if (courseIds.length === 0) return []

  const courses = await ctx.prisma.course.findMany({
    where: {
      id: { in: courseIds },
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
          },
        },
      },
    },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  return courses
}

// Reuse the same course, revision, key and permission constraints for assignment,
// resuming a review, and saving it. Held assignments may outlive any of these.
async function loadCandidates(
  courseId: string,
  ctx: PrismaTransactionContextWithUser,
  ids?: number[]
) {
  if (ids?.length === 0) return []
  const rows = await ctx.prisma.$queryRaw<{ id: number }[]>(DB.Prisma.sql`
    SELECT DISTINCT element."id"
    FROM "ElementInstance" instance
    JOIN "Element" element
      ON element."id" = instance."elementId"
    LEFT JOIN "ElementStack" stack
      ON stack."id" = instance."elementStackId"
    LEFT JOIN "PracticeQuiz" practice_quiz
      ON practice_quiz."id" = stack."practiceQuizId"
    LEFT JOIN "MicroLearning" micro_learning
      ON micro_learning."id" = stack."microLearningId"
    LEFT JOIN "GroupActivity" group_activity
      ON group_activity."id" = stack."groupActivityId"
    LEFT JOIN "ElementBlock" block
      ON block."id" = instance."elementBlockId"
    LEFT JOIN "LiveQuiz" live_quiz
      ON live_quiz."id" = block."liveQuizId"
    JOIN "DerivedPermission" permission
      ON permission."elementId" = element."id"
    WHERE instance."elementData" ->> 'id' =
      element."id"::text || '-v' || element."version"::text
      AND COALESCE(
        (instance."elementData" -> 'options' ->> 'hasSampleSolution')::boolean,
        false
      )
      AND element."type" IN ('SC', 'KPRIM')
      AND element."isDeleted" = false
      AND element."isArchived" = false
      AND permission."userId" = ${ctx.user.sub}::uuid
      AND permission."permissionLevel" IN (
        'READ',
        'EXECUTE',
        'WRITE',
        'ADMIN',
        'OWNER'
      )
      AND (
        (practice_quiz."courseId" = ${courseId}::uuid
          AND practice_quiz."isDeleted" = false)
        OR (micro_learning."courseId" = ${courseId}::uuid
          AND micro_learning."isDeleted" = false)
        OR (group_activity."courseId" = ${courseId}::uuid
          AND group_activity."isDeleted" = false)
        OR (live_quiz."courseId" = ${courseId}::uuid
          AND live_quiz."isDeleted" = false)
      )
      ${ids ? DB.Prisma.sql`AND element."id" IN (${DB.Prisma.join(ids)})` : DB.Prisma.empty}
    ORDER BY element."id"
  `)

  if (!rows.length) return []
  const elements = await ctx.prisma.element.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: {
      id: true,
      version: true,
      originalId: true,
      name: true,
      content: true,
      options: true,
      type: true,
      tags: { where: { ownerId: ctx.user.sub }, select: { name: true } },
    },
  })
  return elements.flatMap((element) => {
    const candidate = toCandidate(element)
    return candidate &&
      candidate.stem.trim() &&
      candidate.choices.every((choice) => choice.text.trim())
      ? [candidate]
      : []
  })
}

function itemView(
  row: DB.LecturerRatingItem,
  candidate?: LecturerRatingCandidate
): LecturerRatingItem {
  const available =
    candidate &&
    candidate.version === row.elementVersion &&
    candidate.format === row.format &&
    getLecturerRatingFamilyKey(candidate) === row.familyKey
  return {
    id: row.id,
    position: row.position,
    elementVersion: row.elementVersion,
    ratingVersion: row.updatedAt.toISOString(),
    format: row.format,
    reviewed: row.reviewedAt !== null,
    unavailable: !available,
    title: available ? candidate.title : '',
    stem: available ? candidate.stem : '',
    choices: available ? candidate.choices : [],
    difficulty: available ? row.difficulty : null,
    bloom: available ? row.bloom : null,
  }
}

// A concurrent start must reuse the winning assignment. Revision, course and
// permission changes must be checked again if Postgres retries a write.
async function inRatingTransaction<T>(
  ctx: ContextWithUser,
  operation: (ctx: PrismaTransactionContextWithUser) => Promise<T>
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ctx.prisma.$transaction(
        (tx) => operation({ ...ctx, prisma: tx }),
        {
          isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        }
      )
    } catch (error) {
      if (
        attempt >= 2 ||
        !(isPrismaError(error, 'P2034') || isPrismaError(error, 'P2002'))
      )
        throw error
    }
  }
}

export async function startLecturerRatingSession(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
): Promise<LecturerRatingSession> {
  return inRatingTransaction(ctx, async (tx) => {
    await assertConfiguredCourseManager(courseId, tx)
    const existing = await tx.prisma.lecturerRatingSession.findUnique({
      where: { courseId_reviewerId: { courseId, reviewerId: ctx.user.sub } },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    const candidates = await loadCandidates(
      courseId,
      tx,
      existing?.items.length
        ? existing.items.map((r) => r.elementId)
        : undefined
    )
    const byId = new Map(candidates.map((c) => [c.id, c]))
    const assignment =
      existing ??
      (await tx.prisma.lecturerRatingSession.create({
        data: { courseId, reviewerId: ctx.user.sub },
      }))
    let items = existing?.items ?? []
    if (!items.length && candidates.length) {
      const sample = selectLecturerRatingFamilies(candidates, 10)
      await tx.prisma.lecturerRatingItem.createMany({
        data: sample.map((c, index) => ({
          sessionId: assignment.id,
          elementId: c.id,
          elementVersion: c.version,
          familyKey: getLecturerRatingFamilyKey(c),
          format: c.format,
          position: index + 1,
        })),
      })
      items = await tx.prisma.lecturerRatingItem.findMany({
        where: { sessionId: assignment.id },
        orderBy: { position: 'asc' },
      })
    }
    return {
      id: assignment.id,
      courseId,
      items: items.map((row) => itemView(row, byId.get(row.elementId))),
    }
  })
}

export async function saveLecturerRating(
  {
    courseId,
    itemId,
    expectedVersion,
    difficulty = null,
    bloom = null,
  }: {
    courseId: string
    itemId: string
    expectedVersion: string
    difficulty?: number | null
    bloom?: string | null
  },
  ctx: ContextWithUser
): Promise<LecturerRatingItem> {
  return inRatingTransaction(ctx, async (tx) => {
    await assertConfiguredCourseManager(courseId, tx)
    const row = await tx.prisma.lecturerRatingItem.findFirst({
      where: { id: itemId, session: { courseId, reviewerId: ctx.user.sub } },
    })
    if (!row)
      throw graphQLError(
        'Rating assignment not found',
        'LECTURER_RATING_ITEM_NOT_FOUND'
      )
    if (
      !(await checkAccess(
        [
          {
            elementId: row.elementId,
            minimumPermissionLevel: DB.PermissionLevel.READ,
          },
        ],
        tx
      ))
    )
      throw graphQLError(
        'Item read access required',
        'LECTURER_RATING_FORBIDDEN'
      )
    const [candidate] = await loadCandidates(courseId, tx, [row.elementId])
    if (
      !candidate ||
      candidate.version !== row.elementVersion ||
      candidate.format !== row.format ||
      getLecturerRatingFamilyKey(candidate) !== row.familyKey
    )
      throw graphQLError(
        'This question is no longer available in this session',
        'LECTURER_RATING_ITEM_STALE'
      )
    if (
      difficulty !== null &&
      (!Number.isInteger(difficulty) ||
        difficulty < 1 ||
        difficulty > (row.format === 'KPRIM' ? 4 : 5))
    )
      throw graphQLError(
        'Choose a difficulty band for this question format',
        'BAD_USER_INPUT'
      )
    if (
      bloom !== null &&
      !LECTURER_RATING_BLOOM_LEVELS.includes(bloom as LecturerRatingBloomLevel)
    )
      throw graphQLError('Unknown Bloom level', 'BAD_USER_INPUT')
    if (row.reviewedAt && row.difficulty === difficulty && row.bloom === bloom)
      return itemView(row, candidate)
    if (expectedVersion !== row.updatedAt.toISOString()) {
      throw graphQLError(
        'The rating was edited in another session',
        'LECTURER_RATING_CONFLICT'
      )
    }
    const savedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1))
    const updated = await tx.prisma.lecturerRatingItem.update({
      where: { id: row.id },
      data: { difficulty, bloom, reviewedAt: savedAt, updatedAt: savedAt },
    })
    return itemView(updated, candidate)
  })
}
