import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDisposableTestPrismaClient } from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { buildSchema, parse, validate } from 'graphql'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  main,
  mutationForDeletion,
  performDeletionAction,
} from '../src/scripts/deleteLecturerAccount.js'
import { deleteCourse } from '../src/services/courses.js'
import type {
  DeletionAction,
  DeletionTarget,
} from '../src/services/lecturerDeletion.js'

const { graphql } = createRequire(import.meta.url)(
  'graphql'
) as typeof import('graphql')

describe('lecturer deletion command contract', () => {
  it('has offline help without database or cloud configuration', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/scripts/deleteLecturerAccount.ts', '--help'],
      { cwd: process.cwd(), env: { PATH: process.env.PATH }, encoding: 'utf8' }
    )
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
  })

  it('validates every business operation against the actual public GraphQL contract', () => {
    const schema = buildSchema(
      readFileSync(
        new URL('../src/public/schema.graphql', import.meta.url),
        'utf8'
      )
    )
    const actions: DeletionAction[] = [
      { kind: 'element', id: 1 },
      { kind: 'tag', id: 1 },
      { kind: 'answerCollection', id: 1 },
      { kind: 'catalogCollection', id: randomUUID() },
      { kind: 'liveQuiz', id: randomUUID() },
      { kind: 'practiceQuiz', id: randomUUID() },
      { kind: 'microLearning', id: randomUUID() },
      { kind: 'groupActivity', id: randomUUID() },
      { kind: 'course', id: randomUUID() },
      ...['LIVE_QUIZ', 'PRACTICE_QUIZ', 'MICRO_LEARNING', 'GROUP_ACTIVITY'].map(
        (activityType) => ({
          kind: 'liveQuiz' as const,
          id: randomUUID(),
          status: 'TEMPLATE',
          activityType,
        })
      ),
    ]
    for (const action of actions)
      expect(
        validate(schema, parse(mutationForDeletion(action).query))
      ).toEqual([])
  })

  it('does not count a refused business mutation as deletion', async () => {
    let calls = 0
    const request = async <T>() => {
      calls++
      return { result: null } as T
    }
    await expect(
      performDeletionAction({ kind: 'element', id: 1 }, request)
    ).rejects.toThrow()
    expect(calls).toBe(1)
  })

  it('rejects apply arguments before creating clients', async () => {
    await expect(main(['--apply'])).rejects.toThrow()
  })
})

describe('lecturer deletion operator orchestration', () => {
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

  async function commandHarness(
    target: DeletionTarget,
    options: {
      loseElementResponse?: boolean
      holdCourse?: boolean
      addMediaAfterElement?: boolean
    } = {}
  ) {
    const dir = await mkdtemp(join(tmpdir(), 'lecturer-deletion-'))
    const emitter = new EventEmitter()
    const context = {
      prisma,
      emitter,
      user: { sub: target.id, role: 'USER', scope: 'ACCOUNT_OWNER' },
      hatchet: { events: { push: vi.fn() } },
    } as unknown as ContextWithUser
    context.hatchet.events.push = vi.fn(async (_name, event) => {
      if (!options.holdCourse) {
        await deleteCourse(
          {
            id: event.courseId,
            deleteDraftActivities: false,
            request: {
              deletionRequestedAt: new Date(event.deletionRequestedAt),
              requestedById: target.id,
            },
          },
          context
        )
      }
      return {} as never
    })
    const now = Date.now.bind(Date)
    let offset = 0
    let ticking = false
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      if (ticking) offset += 65_000
      return now() + offset
    })
    const storage = {
      deleteIfExists: vi.fn(async () => undefined),
      exists: vi.fn(async () => {
        offset = 32_000
        return false
      }),
    }
    const scan = vi.fn(async () => ['0', []] as [string, string[]])
    vi.doMock('ioredis', () => ({
      Redis: class extends EventEmitter {
        scan = scan
        connect = async () => {}
        disconnect = () => {}
      },
    }))
    vi.doMock('@klicker-uzh/prisma/client', async (original) => ({
      ...(await original<Record<string, unknown>>()),
      PrismaClient: function createTestClient() {
        return new Proxy(prisma, {
          get(target, property) {
            if (property === '$disconnect') return async () => {}
            const value = Reflect.get(target, property)
            return typeof value === 'function' ? value.bind(target) : value
          },
        })
      },
    }))
    vi.doMock('@azure/storage-blob', () => ({
      BlobServiceClient: class {
        getContainerClient(id: string) {
          expect(id).toBe(target.id)
          return storage
        }
      },
      StorageSharedKeyCredential: class {},
    }))
    for (const [key, value] of Object.entries({
      APP_SECRET: randomUUID(),
      LECTURER_DELETION_API_URL: 'http://127.0.0.1/graphql',
      BLOB_STORAGE_ACCOUNT_NAME: 'synthetic',
      BLOB_STORAGE_ACCESS_KEY: randomUUID(),
      REDIS_HOST: 'synthetic-unused',
    }))
      vi.stubEnv(key, value)
    let lost = false
    const operations: string[] = []
    const registered = JSON.parse(
      readFileSync(
        new URL('../src/public/server.json', import.meta.url),
        'utf8'
      )
    ) as Record<string, string>
    const request = vi.fn(
      async (_url: unknown, init: RequestInit | undefined) => {
        const body = JSON.parse(String(init?.body)) as {
          extensions: {
            persistedQuery: { version: number; sha256Hash: string }
          }
          variables: Record<string, unknown>
        }
        expect(body.extensions.persistedQuery.version).toBe(1)
        const query = registered[body.extensions.persistedQuery.sha256Hash]!
        expect(query).toBeDefined()
        operations.push(query)
        const result = await graphql({
          schema,
          source: query,
          variableValues: body.variables,
          contextValue: context,
        })
        if (
          options.loseElementResponse &&
          !lost &&
          query.includes('deleteElement(')
        ) {
          lost = true
          throw new Error('synthetic lost response')
        }
        if (options.addMediaAfterElement && query.includes('deleteElement(')) {
          await prisma.mediaFile.create({
            data: {
              ownerId: target.id,
              href: `https://synthetic.blob.core.windows.net/${target.id}/new.png`,
              name: '',
              type: 'image/png',
            },
          })
        }
        if (options.holdCourse && query.includes('requestCourseDeletion('))
          ticking = true
        return new Response(JSON.stringify(result), {
          headers: { 'content-type': 'application/json' },
        })
      }
    )
    vi.stubGlobal('fetch', request)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const args = [
      '--user',
      target.id,
      '--email',
      target.email,
      '--state-dir',
      dir,
    ]
    return {
      dir,
      request,
      operations,
      storage,
      scan,
      preview: () => main(args),
      async apply(resume = false) {
        const saved = JSON.parse(
          await readFile(join(dir, 'preview.json'), 'utf8')
        )
        return main([
          ...args,
          '--apply',
          '--confirm-user',
          target.id,
          '--confirm-email',
          target.email,
          '--confirm-environment',
          saved.environment,
          ...(resume ? ['--resume'] : []),
        ])
      },
      async close() {
        log.mockRestore()
        clock.mockRestore()
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.doUnmock('ioredis')
        vi.doUnmock('@klicker-uzh/prisma/client')
        vi.doUnmock('@azure/storage-blob')
        await rm(dir, { recursive: true, force: true })
      },
    }
  }

  it('stops the whole command before API or storage effects when sharing exists', async () => {
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
    const harness = await commandHarness(target)
    try {
      await harness.preview()
      await expect(harness.apply()).rejects.toThrow()
      expect(harness.request).not.toHaveBeenCalled()
      expect(harness.storage.deleteIfExists).not.toHaveBeenCalled()
      expect(
        (await prisma.element.findUniqueOrThrow({ where: { id: element.id } }))
          .isDeleted
      ).toBe(false)
    } finally {
      await harness.close()
    }
  })

  it('resumes an uncertain soft deletion without replaying the mutation, then deletes the account last', async () => {
    const target = await user()
    const element = await question(target)
    await prisma.session.create({
      data: {
        userId: target.id,
        sessionToken: randomUUID(),
        expires: new Date(Date.now() + 60_000),
      },
    })
    await prisma.mediaFile.create({
      data: {
        ownerId: target.id,
        href: `https://synthetic.blob.core.windows.net/${target.id}/image.png`,
        name: '',
        type: 'image/png',
      },
    })
    const foreign = await user()
    const foreignElement = await question(foreign)
    const harness = await commandHarness(target, { loseElementResponse: true })
    try {
      await harness.preview()
      await expect(harness.apply()).rejects.toThrow()
      expect(
        (await prisma.element.findUniqueOrThrow({ where: { id: element.id } }))
          .isDeleted
      ).toBe(true)
      expect(harness.storage.deleteIfExists).not.toHaveBeenCalled()
      await harness.apply(true)
      expect(
        await prisma.user.findUnique({ where: { id: target.id } })
      ).toBeNull()
      expect(
        await prisma.element.findUnique({ where: { id: foreignElement.id } })
      ).not.toBeNull()
      const mutations = harness.operations.filter((query) =>
        query.includes('deleteElement(')
      )
      expect(mutations).toHaveLength(1)
      expect(harness.storage.deleteIfExists).toHaveBeenCalledOnce()
      expect(
        await prisma.auditLogEntry.count({
          where: {
            OR: [{ sourceUserId: target.id }, { targetUserId: target.id }],
          },
        })
      ).toBe(0)
    } finally {
      await harness.close()
    }
  })

  it('deletes draft activities and a course through their real mutations before questions', async () => {
    const target = await user()
    const date = new Date()
    const ownerPermission = {
      create: { userId: target.id, permissionLevel: 'OWNER' as const },
    }
    const course = await prisma.course.create({
      data: {
        ownerId: target.id,
        authType: 'SSO',
        name: '',
        displayName: '',
        startDate: date,
        endDate: date,
        groupDeadlineDate: date,
        permissions: ownerPermission,
      },
    })
    await prisma.liveQuiz.create({
      data: {
        ownerId: target.id,
        courseId: course.id,
        name: '',
        displayName: '',
        permissions: ownerPermission,
      },
    })
    await prisma.practiceQuiz.create({
      data: {
        ownerId: target.id,
        courseId: course.id,
        name: '',
        displayName: '',
        permissions: ownerPermission,
      },
    })
    await prisma.microLearning.create({
      data: {
        ownerId: target.id,
        courseId: course.id,
        name: '',
        displayName: '',
        scheduledStartAt: date,
        scheduledEndAt: date,
        permissions: ownerPermission,
      },
    })
    await prisma.groupActivity.create({
      data: {
        ownerId: target.id,
        courseId: course.id,
        name: '',
        displayName: '',
        scheduledStartAt: date,
        scheduledEndAt: date,
        permissions: ownerPermission,
      },
    })
    await question(target)
    const harness = await commandHarness(target)
    try {
      await harness.preview()
      await harness.apply()
      expect(
        await prisma.user.findUnique({ where: { id: target.id } })
      ).toBeNull()
      expect(
        harness.operations.filter((query) => query.startsWith('mutation'))
      ).toHaveLength(6)
    } finally {
      await harness.close()
    }
  })

  it('stops before storage if media appears after a business mutation', async () => {
    const target = await user()
    await question(target)
    const harness = await commandHarness(target, { addMediaAfterElement: true })
    try {
      await harness.preview()
      await expect(harness.apply()).rejects.toThrow()
      expect(harness.storage.deleteIfExists).not.toHaveBeenCalled()
      expect(
        await prisma.user.findUnique({ where: { id: target.id } })
      ).not.toBeNull()
      expect(
        await prisma.mediaFile.count({ where: { ownerId: target.id } })
      ).toBe(1)
    } finally {
      await harness.close()
    }
  })

  it('reports a stuck course and observes it on resume without submitting another job', async () => {
    const target = await user()
    const date = new Date()
    const course = await prisma.course.create({
      data: {
        ownerId: target.id,
        authType: 'SSO',
        name: '',
        displayName: '',
        startDate: date,
        endDate: date,
        groupDeadlineDate: date,
        permissions: {
          create: { userId: target.id, permissionLevel: 'OWNER' },
        },
      },
    })
    const harness = await commandHarness(target, { holdCourse: true })
    try {
      await harness.preview()
      await expect(harness.apply()).rejects.toThrow(course.id)
      await expect(harness.apply(true)).rejects.toThrow(course.id)
      const mutations = harness.operations.filter((query) =>
        query.includes('requestCourseDeletion(')
      )
      expect(mutations).toHaveLength(1)
      expect(harness.storage.deleteIfExists).not.toHaveBeenCalled()
    } finally {
      await harness.close()
    }
  })
})
