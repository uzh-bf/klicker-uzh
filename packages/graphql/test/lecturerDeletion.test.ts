import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { prepareHatchetTasks } from '@klicker-uzh/hatchet'
import { createDisposableTestPrismaClient } from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { processElementData } from '@klicker-uzh/util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  type DeletionTarget,
  deleteUnusedLecturerLeaf,
  finalizeLecturerDeletion,
  previewLecturerDeletion,
  purgePrivateElement,
} from '../src/services/lecturerDeletion.js'

const { graphql } = createRequire(import.meta.url)(
  'graphql'
) as typeof import('graphql')

it('requires classification of every registered background task', () => {
  const gates = {
    updateGroupAverageScores: 'retained participant groups',
    runningRandomGroupAssignments: 'retained participant groups',
    finalRandomGroupAssignments: 'retained participant groups',
    updateWeeklyTimelineEntries: 'retained participation',
    sendPushNotifications: 'disabled task',
    publishScheduledGroupActivity:
      'activity status and scheduledPublicationTaskId',
    publishScheduledLiveQuiz: 'activity status and scheduledPublicationTaskId',
    publishScheduledMicroLearning:
      'activity status and scheduledPublicationTaskId',
    publishScheduledPracticeQuiz:
      'activity status and scheduledPublicationTaskId',
    endExpiredGroupActivity: 'activity status and scheduledCompletionTaskId',
    endExpiredMicroLearning: 'activity status and scheduledCompletionTaskId',
    aggregateLiveQuizBlockResultsStandard:
      'published activity or retained results',
    aggregateLiveQuizBlockResultsAssessment:
      'assessment flag and retained results',
    createAuditLogEntry: 'log transport only',
    processCourseDuplication:
      'Redis source locks by operator and source course',
    sweepStaleCourseDuplications: 'same source locks',
    processCourseDeletion: 'course deletionRequestedAt',
  } satisfies Record<keyof ReturnType<typeof prepareHatchetTasks>, string>
  const tasks = prepareHatchetTasks({
    hatchet: { task: (options: unknown) => options },
  } as Parameters<typeof prepareHatchetTasks>[0])
  expect(Object.keys(tasks).sort()).toEqual(Object.keys(gates).sort())
})

describe('cooperative lecturer deletion on marked disposable PostgreSQL', () => {
  let prisma: PrismaClient
  const users: string[] = []
  async function user(): Promise<DeletionTarget> {
    const id = randomUUID()
    const email = `${id}@example.invalid`
    await prisma.user.create({ data: { id, email, shortname: id } })
    users.push(id)
    return { id, email }
  }
  async function question(target: DeletionTarget) {
    return prisma.element.create({
      data: {
        ownerId: target.id,
        name: randomUUID(),
        content: '',
        type: 'FLASHCARD',
        options: {},
        permissions: {
          create: { userId: target.id, permissionLevel: 'OWNER' },
        },
      },
    })
  }
  beforeAll(async () => {
    prisma = await createDisposableTestPrismaClient(process.env.DATABASE_URL!)
  })
  afterAll(async () => {
    if (!prisma) return
    await prisma.auditLogEntry.deleteMany({
      where: { sourceUserId: { in: users } },
    })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    await prisma.$disconnect()
  })

  it('previews private questions without changing the account or permissions', async () => {
    const target = await user()
    const element = await question(target)
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    })
    const first = await previewLecturerDeletion(prisma, target)
    const second = await previewLecturerDeletion(prisma, target)
    expect(first.blockers).toEqual([])
    expect(first.actions).toMatchObject([{ kind: 'element', id: element.id }])
    expect(second.fingerprint).toBe(first.fingerprint)
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: target.id } })
    ).toEqual(before)
    expect(
      await prisma.derivedPermission.count({ where: { elementId: element.id } })
    ).toBe(1)
  })

  it('blocks direct, derived and group access before any business mutation', async () => {
    const target = await user()
    const foreign = await user()
    const element = await question(target)
    await prisma.permission.create({
      data: {
        elementId: element.id,
        userId: foreign.id,
        permissionLevel: 'READ',
      },
    })
    const report = await previewLecturerDeletion(prisma, target)
    expect(report.blockers.some((b) => b.table === 'Permission')).toBe(true)
    expect(
      (await prisma.element.findUniqueOrThrow({ where: { id: element.id } }))
        .isDeleted
    ).toBe(false)
    await expect(
      finalizeLecturerDeletion(prisma, target, { mediaIds: [] })
    ).rejects.toThrow()
    expect(
      await prisma.user.findUnique({ where: { id: foreign.id } })
    ).not.toBeNull()
  })

  it('blocks foreign-owned copies and retained anonymous results', async () => {
    const target = await user()
    const foreign = await user()
    const element = await question(target)
    const now = new Date()
    const course = await prisma.course.create({
      data: {
        ownerId: foreign.id,
        authType: 'SSO',
        name: randomUUID(),
        displayName: '',
        startDate: now,
        endDate: now,
        groupDeadlineDate: now,
      },
    })
    await prisma.practiceQuiz.create({
      data: {
        ownerId: foreign.id,
        courseId: course.id,
        name: '',
        displayName: '',
        stacks: {
          create: {
            order: 0,
            type: 'PRACTICE_QUIZ',
            elements: {
              create: {
                ownerId: foreign.id,
                elementId: element.id,
                type: 'PRACTICE_QUIZ',
                elementType: 'FLASHCARD',
                order: 0,
                options: {},
                elementData: processElementData(element),
                results: { total: 0, INCORRECT: 0, PARTIAL: 0, CORRECT: 0 },
                anonymousResults: {
                  total: 1,
                  INCORRECT: 1,
                  PARTIAL: 0,
                  CORRECT: 0,
                },
              },
            },
          },
        },
      },
    })
    const report = await previewLecturerDeletion(prisma, target)
    expect(report.blockers.some((b) => b.table === 'ElementInstance')).toBe(
      true
    )
    expect(
      await prisma.practiceQuiz.count({ where: { ownerId: foreign.id } })
    ).toBe(1)
  })

  it('blocks copied media references without returning foreign content', async () => {
    const target = await user()
    const foreign = await user()
    const element = await question(foreign)
    const content = `private synthetic prose https://synthetic.blob.core.windows.net/${target.id}/image.png`
    await prisma.element.update({
      where: { id: element.id },
      data: { content },
    })
    const report = await previewLecturerDeletion(prisma, target)
    expect(report.blockers.some((b) => b.kind === 'mediaReference')).toBe(true)
    expect(JSON.stringify(report)).not.toContain(content)
  })

  it('blocks encoded and CDN container references in foreign content', async () => {
    const target = await user()
    const foreign = await user()
    const element = await question(foreign)
    for (const content of [
      `https://cdn.example.invalid/${target.id}/image.png`,
      [...`https://synthetic.blob.core.windows.net/${target.id}/image.png`]
        .map((c) => `%${c.charCodeAt(0).toString(16)}`)
        .join(''),
      JSON.stringify({
        url: `https://synthetic.blob.core.windows.net/${target.id}/image.png`,
      }).replaceAll('/', String.raw`\/`),
    ]) {
      await prisma.element.update({
        where: { id: element.id },
        data: { content },
      })
      const report = await previewLecturerDeletion(prisma, target)
      expect(
        report.blockers.some(
          (b) => b.table === 'Element' && b.id === String(element.id)
        )
      ).toBe(true)
    }
  })

  it('blocks foreign tag links and access held on foreign content', async () => {
    const target = await user()
    const foreign = await user()
    const element = await question(target)
    const tag = await prisma.tag.create({
      data: {
        ownerId: foreign.id,
        name: randomUUID(),
        questions: { connect: { id: element.id } },
      },
    })
    let report = await previewLecturerDeletion(prisma, target)
    expect(report.blockers.some((b) => b.reason === 'non-private-parent')).toBe(
      true
    )
    await prisma.tag.delete({ where: { id: tag.id } })
    const other = await question(foreign)
    await prisma.permission.create({
      data: { elementId: other.id, userId: target.id, permissionLevel: 'READ' },
    })
    report = await previewLecturerDeletion(prisma, target)
    expect(
      report.blockers.some((b) => b.reason === 'foreign-object-access')
    ).toBe(true)
  })

  it('allows empty initial result maps and blocks foreign placements and tombstone references', async () => {
    const target = await user()
    const foreign = await user()
    const element = await question(target)
    const quiz = await prisma.liveQuiz.create({
      data: {
        ownerId: target.id,
        name: '',
        displayName: '',
        permissions: {
          create: { userId: target.id, permissionLevel: 'OWNER' },
        },
      },
    })
    const block = await prisma.elementBlock.create({
      data: { liveQuizId: quiz.id, order: 0 },
    })
    const instance = await prisma.elementInstance.create({
      data: {
        ownerId: target.id,
        elementId: element.id,
        elementBlockId: block.id,
        type: 'LIVE_QUIZ',
        elementType: 'FLASHCARD',
        order: 0,
        options: {},
        elementData: processElementData(element),
        results: { total: 0, CORRECT: 0 },
        anonymousResults: { total: 0, CORRECT: 0 },
      },
    })
    expect((await previewLecturerDeletion(prisma, target)).blockers).toEqual([])
    await prisma.element.update({
      where: { id: element.id },
      data: { isDeleted: true },
    })
    await expect(
      purgePrivateElement(prisma, target, element.id)
    ).rejects.toThrow()
    await prisma.liveQuiz.update({
      where: { id: quiz.id },
      data: { ownerId: foreign.id },
    })
    const report = await previewLecturerDeletion(prisma, target)
    expect(
      report.blockers.some(
        (b) => b.reason === 'non-private-parent' && b.id === String(instance.id)
      )
    ).toBe(true)
  })

  it('fails closed for new User relationships before any cascade is possible', async () => {
    const target = await user()
    const table = `_DeletionProbe${randomUUID().replaceAll('-', '')}`
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${table}" (id uuid PRIMARY KEY, "ownerId" uuid REFERENCES "User"(id) ON DELETE CASCADE)`
    )
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${table}" VALUES ($1::uuid, $2::uuid)`,
        randomUUID(),
        target.id
      )
      const report = await previewLecturerDeletion(prisma, target)
      expect(
        report.blockers.some(
          (b) => b.table === table && b.kind === 'unclassifiedRelation'
        )
      ).toBe(true)
      await expect(
        finalizeLecturerDeletion(prisma, target, { mediaIds: [] })
      ).rejects.toThrow()
      expect(
        await prisma.user.findUnique({ where: { id: target.id } })
      ).not.toBeNull()
    } finally {
      await prisma.$executeRawUnsafe(`DROP TABLE "${table}"`)
    }
  })

  it('reports audit and user-group paths as preflight blockers', async () => {
    const target = await user()
    await prisma.userGroup.create({
      data: { ownerId: target.id, name: randomUUID() },
    })
    await prisma.auditLogEntry.create({
      data: {
        sourceUserId: target.id,
        type: 'USER_GROUP_CREATED',
        objectType: 'USER_GROUP',
        objectId: 'synthetic',
        message: '',
      },
    })
    const report = await previewLecturerDeletion(prisma, target)
    expect(report.blockers.some((b) => b.table === 'UserGroup')).toBe(true)
    expect(report.blockers.some((b) => b.table === 'AuditLogEntry')).toBe(true)
  })

  it('uses ordinary soft deletion, purges only unused tombstones, then removes authentication metadata', async () => {
    const target = await user()
    const foreign = await user()
    const element = await question(target)
    const session = await prisma.session.create({
      data: {
        userId: target.id,
        sessionToken: randomUUID(),
        expires: new Date(Date.now() + 60_000),
      },
    })
    await expect(
      purgePrivateElement(prisma, target, element.id)
    ).rejects.toThrow()
    const context = {
      prisma,
      emitter: new EventEmitter(),
      user: { sub: target.id, role: 'USER', scope: 'ACCOUNT_OWNER' },
    } as ContextWithUser
    const request = async <T>(
      query: string,
      variables: Record<string, unknown>
    ) => {
      const result = await graphql({
        schema,
        source: query,
        variableValues: variables,
        contextValue: context,
      })
      if (result.errors?.length || !result.data)
        throw new Error('Mutation refused')
      return result.data as T
    }
    await request(
      'mutation Delete($id: Int!) { deleteElement(id: $id) { __typename } }',
      { id: element.id }
    )
    expect(
      (await prisma.element.findUniqueOrThrow({ where: { id: element.id } }))
        .isDeleted
    ).toBe(true)
    await purgePrivateElement(prisma, target, element.id)
    await finalizeLecturerDeletion(prisma, target, { mediaIds: [] })
    expect(
      await prisma.user.findUnique({ where: { id: target.id } })
    ).toBeNull()
    expect(
      await prisma.session.findUnique({ where: { id: session.id } })
    ).toBeNull()
    expect(
      await prisma.user.findUnique({ where: { id: foreign.id } })
    ).not.toBeNull()
  })

  it('blocks write-capable delegated logins without changing primary sessions', async () => {
    const target = await user()
    await prisma.userLogin.create({
      data: {
        userId: target.id,
        password: randomUUID(),
        scope: 'FULL_ACCESS',
      },
    })
    const report = await previewLecturerDeletion(prisma, target)
    expect(report.blockers.some((b) => b.kind === 'delegatedLogin')).toBe(true)
  })

  it('removes unused private leaves and refuses a nonempty competency tree', async () => {
    const target = await user()
    const tree = await prisma.competencyTree.create({
      data: { ownerId: target.id, name: randomUUID() },
    })
    const disclaimer = await prisma.chatbotDisclaimer.create({
      data: { ownerId: target.id, name: '', title: '' },
    })
    const preview = await previewLecturerDeletion(prisma, target)
    expect(preview.blockers).toEqual([])
    for (const action of preview.actions)
      await deleteUnusedLecturerLeaf(prisma, target, action)
    expect(
      await prisma.competencyTree.findUnique({ where: { id: tree.id } })
    ).toBeNull()
    expect(
      await prisma.chatbotDisclaimer.findUnique({
        where: { id: disclaimer.id },
      })
    ).toBeNull()
    const nonempty = await prisma.competencyTree.create({
      data: {
        ownerId: target.id,
        name: randomUUID(),
        competencies: { create: { name: '', lft: 1, rgt: 2 } },
      },
    })
    const report = await previewLecturerDeletion(prisma, target)
    expect(report.blockers.some((b) => b.reason === 'leaf-in-use')).toBe(true)
    await expect(
      deleteUnusedLecturerLeaf(prisma, target, {
        kind: 'competencyTree',
        id: nonempty.id,
      })
    ).rejects.toThrow()
  })

  it('refuses wrong target identity and unexpected media at finalization', async () => {
    const target = await user()
    await expect(
      previewLecturerDeletion(prisma, {
        ...target,
        email: 'another@example.invalid',
      })
    ).rejects.toThrow()
    await prisma.mediaFile.create({
      data: {
        id: randomUUID(),
        ownerId: target.id,
        href: `https://synthetic.blob.core.windows.net/${target.id}/image.png`,
        name: '',
        type: 'image/png',
      },
    })
    await expect(
      finalizeLecturerDeletion(prisma, target, { mediaIds: [] })
    ).rejects.toThrow()
    expect(
      await prisma.user.findUnique({ where: { id: target.id } })
    ).not.toBeNull()
  })
})
