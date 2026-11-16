import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { readZip } from './fixtures/readZip.js'

// Enum values and the error class are stubbed so the guards run on the host
// without a generated Prisma client; the values equal the schema enums.
const accessMock = vi.hoisted(() => ({ checkAccess: vi.fn() }))
vi.mock('@klicker-uzh/prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string
    constructor(message: string, init: { code: string }) {
      super(message)
      this.code = init.code
    }
  }
  return {
    DataExportStatus: {
      PENDING: 'PENDING',
      READY: 'READY',
      RELEASED: 'RELEASED',
      FAILED: 'FAILED',
      EXPIRED: 'EXPIRED',
    },
    PermissionLevel: { OWNER: 'OWNER', ADMIN: 'ADMIN' },
    UserRole: { USER: 'USER', ADMIN: 'ADMIN' },
    UserLoginScope: {
      ACCOUNT_OWNER: 'ACCOUNT_OWNER',
      FULL_ACCESS: 'FULL_ACCESS',
    },
    Prisma: {
      PrismaClientKnownRequestError,
      TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' },
    },
  }
})
vi.mock('../src/services/sharing.js', () => accessMock)
vi.mock('../src/services/courses.js', () => ({}))

import { DataExportStatus, Prisma } from '@klicker-uzh/prisma/client'
import {
  ASSESSMENT_TRANSCRIPT_EXPORT_MAX_RETRIES,
  downloadAssessmentTranscriptExport,
  handleProcessAssessmentTranscriptExport,
  handleSweepAssessmentTranscriptExports,
  requestAssessmentTranscriptExport,
} from '../src/services/assessmentTranscriptExports.js'

const ids = {
  request: '11111111-1111-4111-8111-111111111111',
  course: '22222222-2222-4222-8222-222222222222',
  chatbot: '33333333-3333-4333-8333-333333333333',
  user: '44444444-4444-4444-8444-444444444444',
  student: '55555555-5555-4555-8555-555555555555',
}

const body = {
  requestId: ids.request,
  courseId: ids.course,
  chatbotId: ids.chatbot,
  locale: 'en',
  disclosureVersion: 'v1',
  acknowledgement: true,
}

function createPrisma(overrides: Record<string, unknown> = {}) {
  const prisma: any = {
    chatbot: { findFirst: vi.fn().mockResolvedValue({ id: ids.chatbot }) },
    assessmentExportReceipt: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    assessmentExportArtifact: {
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  }
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn(prisma)
  )
  return prisma
}

function createContext(
  prisma: any,
  user: Record<string, unknown> = {}
): ContextWithUser {
  return {
    prisma,
    hatchet: { events: { push: vi.fn().mockResolvedValue({}) } },
    user: { sub: ids.user, role: 'USER', scope: 'ACCOUNT_OWNER', ...user },
  } as unknown as ContextWithUser
}

async function rejectionCode(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return (error as { extensions?: { code?: string } }).extensions?.code
  }
  return undefined
}

beforeEach(() => {
  accessMock.checkAccess.mockReset().mockResolvedValue(true)
})

describe('requestAssessmentTranscriptExport', () => {
  it('schedules a pending receipt and pushes only the export id', async () => {
    const prisma = createPrisma()
    const ctx = createContext(prisma)

    await expect(requestAssessmentTranscriptExport(body, ctx)).resolves.toEqual(
      { exportId: ids.request }
    )
    expect(
      prisma.assessmentExportReceipt.create.mock.calls[0][0].data
    ).toMatchObject({
      id: ids.request,
      requesterId: ids.user,
      chatbotId: ids.chatbot,
    })
    expect((ctx.hatchet.events.push as any).mock.calls[0][1]).toEqual({
      exportId: ids.request,
    })
  })

  it.each([
    ['a student role', { role: 'PARTICIPANT' }, body],
    ['a restricted login scope', { scope: 'ASSESSMENT_ONLY' }, body],
    ['a stale disclosure version', {}, { ...body, disclosureVersion: 'v0' }],
    ['an unknown field', {}, { ...body, scope: 'COURSE' }],
  ])('refuses %s without writing anything', async (_label, user, input) => {
    const prisma = createPrisma()
    const code = await rejectionCode(
      requestAssessmentTranscriptExport(input, createContext(prisma, user))
    )

    expect(code).toMatch(/DATA_EXPORT_(FORBIDDEN|INVALID_REQUEST)/)
    expect(prisma.assessmentExportReceipt.create).not.toHaveBeenCalled()
  })

  it('refuses a user without course ADMIN access', async () => {
    accessMock.checkAccess.mockResolvedValue(false)
    const prisma = createPrisma()

    expect(
      await rejectionCode(
        requestAssessmentTranscriptExport(body, createContext(prisma))
      )
    ).toBe('DATA_EXPORT_FORBIDDEN')
    expect(prisma.assessmentExportReceipt.create).not.toHaveBeenCalled()
  })

  it('refuses a chatbot outside an assessment-enabled course', async () => {
    const prisma = createPrisma()
    prisma.chatbot.findFirst.mockResolvedValue(null)

    expect(
      await rejectionCode(
        requestAssessmentTranscriptExport(body, createContext(prisma))
      )
    ).toBe('DATA_EXPORT_FORBIDDEN')
    expect(prisma.chatbot.findFirst.mock.calls[0][0].where).toMatchObject({
      courseId: ids.course,
      course: { isAssessmentEnabled: true },
    })
    expect(prisma.assessmentExportReceipt.create).not.toHaveBeenCalled()
  })

  it('treats a reused request id as single-use', async () => {
    const prisma = createPrisma()
    prisma.assessmentExportReceipt.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      })
    )

    expect(
      await rejectionCode(
        requestAssessmentTranscriptExport(body, createContext(prisma))
      )
    ).toBe('DATA_EXPORT_REQUEST_ALREADY_USED')
  })

  it('marks the receipt failed when the job cannot be published', async () => {
    const prisma = createPrisma()
    const ctx = createContext(prisma)
    ;(ctx.hatchet.events.push as any).mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(
      await rejectionCode(requestAssessmentTranscriptExport(body, ctx))
    ).toBe('DATA_EXPORT_UNAVAILABLE')
    expect(
      prisma.assessmentExportReceipt.updateMany.mock.calls[0][0]
    ).toMatchObject({
      where: { id: ids.request, status: DataExportStatus.PENDING },
      data: { status: DataExportStatus.FAILED },
    })
  })
})

describe('downloadAssessmentTranscriptExport', () => {
  const future = new Date(Date.now() + 60_000)
  const receipt = (overrides: Record<string, unknown> = {}) => ({
    id: ids.request,
    requesterId: ids.user,
    courseId: ids.course,
    chatbotId: ids.chatbot,
    status: DataExportStatus.READY,
    artifactExpiresAt: future,
    ...overrides,
  })

  it.each([
    ['another requester', receipt({ requesterId: 'someone-else' })],
    ['a CSV receipt without chatbot', receipt({ chatbotId: null })],
    ['a missing receipt', null],
  ])('refuses %s', async (_label, found) => {
    const prisma = createPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(found)

    expect(
      await rejectionCode(
        downloadAssessmentTranscriptExport(ids.request, createContext(prisma))
      )
    ).toBe('DATA_EXPORT_FORBIDDEN')
  })

  it('refuses after the ADMIN permission was revoked', async () => {
    const prisma = createPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(receipt())
    accessMock.checkAccess.mockResolvedValue(false)

    expect(
      await rejectionCode(
        downloadAssessmentTranscriptExport(ids.request, createContext(prisma))
      )
    ).toBe('DATA_EXPORT_FORBIDDEN')
  })

  it.each([
    DataExportStatus.PENDING,
    DataExportStatus.FAILED,
  ])('only reports status %s', async (status) => {
    const prisma = createPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(
      receipt({ status })
    )

    await expect(
      downloadAssessmentTranscriptExport(ids.request, createContext(prisma))
    ).resolves.toEqual({ status })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('refuses an expired archive even before the sweep ran', async () => {
    const prisma = createPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(
      receipt({ artifactExpiresAt: new Date(Date.now() - 1) })
    )

    await expect(
      downloadAssessmentTranscriptExport(ids.request, createContext(prisma))
    ).resolves.toEqual({ status: DataExportStatus.EXPIRED })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('releases the archive once and deletes it', async () => {
    const prisma = createPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(receipt())
    prisma.assessmentExportArtifact.findUnique.mockResolvedValue({
      content: new Uint8Array([1, 2, 3]),
    })

    const first = await downloadAssessmentTranscriptExport(
      ids.request,
      createContext(prisma)
    )
    expect(first).toMatchObject({ status: 'READY', exportId: ids.request })
    expect((first as { body: Buffer }).body).toEqual(Buffer.from([1, 2, 3]))
    expect(
      prisma.assessmentExportReceipt.updateMany.mock.calls[0][0]
    ).toMatchObject({
      where: { id: ids.request, status: DataExportStatus.READY },
      data: { status: DataExportStatus.RELEASED },
    })
    expect(prisma.assessmentExportArtifact.delete).toHaveBeenCalledOnce()

    // a concurrent second download loses the claim and receives nothing
    prisma.assessmentExportReceipt.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      downloadAssessmentTranscriptExport(ids.request, createContext(prisma))
    ).resolves.toEqual({ status: DataExportStatus.RELEASED })
    expect(prisma.assessmentExportArtifact.delete).toHaveBeenCalledOnce()
  })
})

describe('handleProcessAssessmentTranscriptExport', () => {
  const pending = {
    id: ids.request,
    requesterId: ids.user,
    courseId: ids.course,
    chatbotId: ids.chatbot,
    status: DataExportStatus.PENDING,
  }

  function workerPrisma(overrides: Record<string, unknown> = {}) {
    return createPrisma({
      derivedPermission: { findFirst: vi.fn().mockResolvedValue({ id: 'p' }) },
      chatbot: {
        findFirst: vi.fn().mockResolvedValue({
          id: ids.chatbot,
          name: 'Exam bot',
          course: { id: ids.course, name: 'Course', isAssessmentEnabled: true },
        }),
      },
      participation: {
        findMany: vi.fn().mockResolvedValue([
          {
            participantId: ids.student,
            assessmentGivenName: 'Ada',
            assessmentSurname: 'Example',
            assessmentMatriculationNumber: '00-000-001',
            participant: { username: 'student', email: null },
          },
        ]),
      },
      participantInvitation: { findMany: vi.fn().mockResolvedValue([]) },
      chatThread: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 't1',
            participantId: ids.student,
            title: null,
            createdAt: new Date('2026-12-16T09:00:00Z'),
            messages: [
              {
                id: 'm1',
                parentId: null,
                role: 'user',
                content: [{ type: 'text', text: 'synthetic question' }],
                chatMode: 'exam',
                modelId: 'model',
                lifecycleStatus: 'COMPLETED',
                createdAt: new Date('2026-12-16T09:00:01Z'),
                attachments: [],
              },
            ],
          },
        ]),
      },
      ...overrides,
    })
  }

  function run(prisma: any, retryCount = 0) {
    const logger = { error: vi.fn(), info: vi.fn() }
    const result = handleProcessAssessmentTranscriptExport(
      { exportId: ids.request },
      { prisma } as any,
      { retryCount: () => retryCount, logger } as any
    )
    return { result, logger }
  }

  it('stores a ZIP with overview, viewer and one JSON per roster entry', async () => {
    const prisma = workerPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(pending)

    await expect(run(prisma).result).resolves.toBe(true)

    expect(
      prisma.assessmentExportReceipt.updateMany.mock.calls[0][0]
    ).toMatchObject({
      where: { id: ids.request, status: DataExportStatus.PENDING },
      data: { status: DataExportStatus.READY, recordCount: 1 },
    })
    const stored = prisma.assessmentExportArtifact.create.mock.calls[0][0].data
    const files = readZip(Buffer.from(stored.content))
    expect(Object.keys(files).sort()).toEqual([
      'overview.csv',
      `students/0001-${ids.student}.json`,
      'viewer.html',
    ])
    for (const name of Object.keys(files)) {
      expect(name).not.toMatch(/\.\.|\\/)
      expect(name).not.toContain('Ada')
    }
    const student = JSON.parse(
      files[`students/0001-${ids.student}.json`]?.toString() as string
    )
    expect(student.formatVersion).toBe(1)
    expect(student.threads[0].messages[0].text).toBe('synthetic question')
  })

  it('does nothing for a receipt that is no longer pending', async () => {
    const prisma = workerPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue({
      ...pending,
      status: DataExportStatus.READY,
    })

    await expect(run(prisma).result).resolves.toBe(false)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('fails at once when the requester lost ADMIN access', async () => {
    const prisma = workerPrisma({
      derivedPermission: { findFirst: vi.fn().mockResolvedValue(null) },
    })
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(pending)

    await expect(run(prisma).result).resolves.toBe(false)
    expect(
      prisma.assessmentExportReceipt.updateMany.mock.calls[0][0]
    ).toMatchObject({
      data: {
        status: DataExportStatus.FAILED,
        failureCode: 'DATA_EXPORT_FORBIDDEN',
      },
    })
    expect(prisma.assessmentExportArtifact.create).not.toHaveBeenCalled()
  })

  it('refuses a course without the assessment flag', async () => {
    const prisma = workerPrisma({
      chatbot: {
        findFirst: vi.fn().mockResolvedValue({
          id: ids.chatbot,
          name: 'Bot',
          course: { id: ids.course, name: 'C', isAssessmentEnabled: false },
        }),
      },
    })
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(pending)

    await expect(run(prisma).result).resolves.toBe(false)
    expect(prisma.assessmentExportArtifact.create).not.toHaveBeenCalled()
  })

  it('keeps the receipt pending on a non-final retry and fails on the last', async () => {
    const prisma = workerPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(pending)
    prisma.chatThread.findMany.mockRejectedValue(new Error('db down'))

    await expect(run(prisma, 0).result).rejects.toThrow('db down')
    expect(prisma.assessmentExportReceipt.updateMany).not.toHaveBeenCalled()

    await expect(
      run(prisma, ASSESSMENT_TRANSCRIPT_EXPORT_MAX_RETRIES).result
    ).rejects.toThrow('db down')
    expect(
      prisma.assessmentExportReceipt.updateMany.mock.calls[0][0]
    ).toMatchObject({
      where: { status: DataExportStatus.PENDING },
      data: { status: DataExportStatus.FAILED },
    })
  })

  it('never logs transcript text', async () => {
    const prisma = workerPrisma()
    prisma.assessmentExportReceipt.findUnique.mockResolvedValue(pending)
    prisma.chatThread.findMany.mockRejectedValue(new Error('db down'))
    const { result, logger } = run(
      prisma,
      ASSESSMENT_TRANSCRIPT_EXPORT_MAX_RETRIES
    )
    await result.catch(() => undefined)

    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'synthetic question'
    )
  })
})

describe('handleSweepAssessmentTranscriptExports', () => {
  it('expires unused archives and fails stale pending requests', async () => {
    const prisma = createPrisma()
    await expect(
      handleSweepAssessmentTranscriptExports({}, { prisma } as any, {} as any)
    ).resolves.toBe(true)

    const [expire, stale] = prisma.assessmentExportReceipt.updateMany.mock.calls
    expect(expire[0]).toMatchObject({
      where: { status: DataExportStatus.READY },
      data: { status: DataExportStatus.EXPIRED },
    })
    expect(stale[0]).toMatchObject({
      where: { status: DataExportStatus.PENDING },
      data: { status: DataExportStatus.FAILED },
    })
    const cutoff = stale[0].where.attestedAt.lt as Date
    expect(Date.now() - cutoff.getTime()).toBeGreaterThan(60 * 60 * 1000)
    expect(prisma.assessmentExportArtifact.deleteMany).toHaveBeenCalledOnce()
  })
})
