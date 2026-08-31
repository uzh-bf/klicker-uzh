import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  allowCourseDeletionMutationInTransaction,
  allowCoursePurgeInTransaction,
} from '@klicker-uzh/prisma'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import bcrypt from 'bcryptjs'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const DATABASE_URL = process.env.TEST_DATABASE_URL
const DISPOSABLE_DATABASE_MARKER = '1'
const REQUIRE_DISPOSABLE_DATABASE =
  process.env.TEST_DATABASE_DISPOSABLE_REQUIRED === '1'
const APPLY_FLAG = '--apply'
const SCRIPT_DIRECTORY = fileURLToPath(new URL('.', import.meta.url))
const USERNAMES = [
  'teststudent-iuw',
  'teststudent-rsv',
  'teststudent-culture',
  'teststudent',
]
const PASSWORDS = {
  IuW: 'local-only-iuw-password',
  RadioSurfVet: 'local-only-rsv-password',
  Culture: 'local-only-culture-password',
} as const
const PASSWORD_ENV = {
  IuW: 'KLICKER_DEMO_IUW_PARTICIPANT_PASSWORD',
  RadioSurfVet: 'KLICKER_DEMO_RADIOSURFVET_PARTICIPANT_PASSWORD',
  Culture: 'KLICKER_DEMO_CULTURE_PARTICIPANT_PASSWORD',
} as const

const isDisposableDatabase = (databaseUrl: string | undefined) => {
  if (
    !databaseUrl ||
    process.env.TEST_DATABASE_DISPOSABLE !== DISPOSABLE_DATABASE_MARKER
  ) {
    return false
  }

  try {
    const hostname = new URL(databaseUrl).hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
    return ['postgres', 'localhost', '127.0.0.1', '::1'].includes(hostname)
  } catch {
    return false
  }
}

if (REQUIRE_DISPOSABLE_DATABASE && !isDisposableDatabase(DATABASE_URL)) {
  throw new Error('disposable_test_database_required')
}

const runScript = (
  args: Array<string>,
  passwordLabels: Array<keyof typeof PASSWORDS> = []
) =>
  execFileSync(
    process.execPath,
    [
      '../../node_modules/tsx/dist/cli.mjs',
      '2026-08-24_seed_demo_participants.ts',
      ...args,
    ],
    {
      cwd: SCRIPT_DIRECTORY,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL,
        ...Object.fromEntries(
          passwordLabels.map((label) => [PASSWORD_ENV[label], PASSWORDS[label]])
        ),
      },
      timeout: 120000,
    }
  )

const runFailingScript = (
  args: Array<string>,
  passwordLabels: Array<keyof typeof PASSWORDS> = []
) => {
  try {
    return runScript(args, passwordLabels)
  } catch (error) {
    const result = error as {
      stdout?: Buffer | string
      stderr?: Buffer | string
    }
    return `${result.stdout ?? ''}${result.stderr ?? ''}`
  }
}

const testDescribe = isDisposableDatabase(DATABASE_URL)
  ? describe
  : describe.skip

testDescribe('seed demo participants', () => {
  const adapter = new PrismaPg({ connectionString: DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  let ownerId = ''
  let fixtureInitialized = false
  const courseIds = new Map<string, string>()
  const createdParticipantIds = new Set<string>()

  const rememberCreatedParticipants = async () => {
    const participants = await prisma.participant.findMany({
      where: { username: { in: USERNAMES } },
      select: { id: true },
    })
    for (const participant of participants) {
      createdParticipantIds.add(participant.id)
    }
  }

  const cleanupCreatedParticipants = async () => {
    if (createdParticipantIds.size === 0) return

    await prisma.participant.deleteMany({
      where: { id: { in: [...createdParticipantIds] } },
    })
    createdParticipantIds.clear()
  }

  beforeAll(async () => {
    const [existingOwnerCount, existingParticipantCount] = await Promise.all([
      prisma.user.count({ where: { shortname: 'klick' } }),
      prisma.participant.count({ where: { username: { in: USERNAMES } } }),
    ])
    if (existingOwnerCount > 0 || existingParticipantCount > 0) {
      throw new Error('fixture_database_not_empty')
    }

    const owner = await prisma.user.create({
      data: {
        email: 'demo-participant-owner@local.invalid',
        shortname: 'klick',
      },
      select: { id: true },
    })
    ownerId = owner.id
    fixtureInitialized = true

    for (const [index, [courseName, chatbotName]] of [
      ['testkurs IuW', 'Informatik und Wirtschaft'],
      ['testkurs RadioSurfVet', 'RadioSurfVet'],
      ['Demo Course Copy', 'Culture Scenario Lab'],
    ].entries() as IterableIterator<[number, readonly [string, string]]>) {
      const course = await prisma.course.create({
        data: {
          name: courseName,
          displayName: courseName,
          pinCode: 100001 + index,
          ownerId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          groupDeadlineDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          chatbots: {
            create: {
              name: chatbotName,
              ownerId,
            },
          },
        },
        select: { id: true },
      })
      courseIds.set(courseName, course.id)
    }
  })

  afterEach(async () => {
    await rememberCreatedParticipants()
  })

  afterAll(async () => {
    if (fixtureInitialized) {
      await rememberCreatedParticipants()
      await cleanupCreatedParticipants()
      await prisma.$transaction(async (tx) => {
        await allowCoursePurgeInTransaction(tx)
        await tx.course.updateMany({
          where: { ownerId },
          data: { isDeleted: true },
        })
        await tx.course.deleteMany({ where: { ownerId, isDeleted: true } })
      })
      await prisma.user
        .delete({ where: { id: ownerId } })
        .catch(() => undefined)
    }
    await prisma.$disconnect()
  })

  it('defaults to a values-free no-write dry run and supports readback', async () => {
    await cleanupCreatedParticipants()

    const output = runScript([])

    expect(output).toContain('mode=dry-run writes=false')
    expect(output).toContain('target=IuW courseMatch=true chatbotMatch=true')
    expect(output).toContain('target=Culture accountExisting=false')
    expect(USERNAMES.some((username) => output.includes(username))).toBe(false)
    expect(
      Object.values(PASSWORDS).some((password) => output.includes(password))
    ).toBe(false)
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)

    const readback = runFailingScript(['--readback'])
    expect(readback).toContain('status=failed code=missing_on_readback_IuW')
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)
  })

  it('fails closed when a target course is pending deletion', async () => {
    const courseId = courseIds.get('testkurs IuW')!
    await prisma.course.update({
      where: { id: courseId },
      data: { isDeletionPending: true },
    })
    try {
      const output = runFailingScript(
        [APPLY_FLAG],
        ['IuW', 'RadioSurfVet', 'Culture']
      )
      expect(output).toContain('status=failed code=target_resolution_IuW')
    } finally {
      await prisma.$transaction(async (tx) => {
        await allowCourseDeletionMutationInTransaction(tx)
        await tx.course.update({
          where: { id: courseId },
          data: { isDeletionPending: false },
        })
      })
    }
  })

  it('creates all three accounts and replays as a database no-op', async () => {
    await cleanupCreatedParticipants()

    const first = runScript([APPLY_FLAG], ['IuW', 'RadioSurfVet', 'Culture'])
    expect(first).toContain('mode=apply writes=true')
    expect(first).toContain('target=Culture accountActive=true')
    expect(first).toContain('passwordMatches=true')
    expect(
      Object.values(PASSWORDS).some((password) => first.includes(password))
    ).toBe(false)

    const readback = runScript(['--readback'])
    expect(readback).toContain('mode=readback writes=false')
    expect(USERNAMES.some((username) => readback.includes(username))).toBe(
      false
    )

    const before = await prisma.participant.findMany({
      where: { username: { in: USERNAMES.slice(0, 3) } },
      select: {
        id: true,
        username: true,
        password: true,
        updatedAt: true,
        participations: {
          select: { courseId: true, isActive: true, updatedAt: true },
        },
      },
      orderBy: { username: 'asc' },
    })

    const second = runScript([APPLY_FLAG], ['IuW', 'RadioSurfVet', 'Culture'])
    expect(second).toContain('mode=apply writes=true')

    const after = await prisma.participant.findMany({
      where: { username: { in: USERNAMES.slice(0, 3) } },
      select: {
        id: true,
        username: true,
        password: true,
        updatedAt: true,
        participations: {
          select: { courseId: true, isActive: true, updatedAt: true },
        },
      },
      orderBy: { username: 'asc' },
    })

    expect(after).toEqual(before)
    expect(after).toHaveLength(3)
    for (const participant of after) {
      expect(participant.participations.filter((p) => p.isActive)).toHaveLength(
        1
      )
    }
  }, 30_000)

  it('repairs existing manual target accounts and replays as a no-op', async () => {
    await cleanupCreatedParticipants()
    const iuwCourseId = courseIds.get('testkurs IuW')!
    const rsvCourseId = courseIds.get('testkurs RadioSurfVet')!
    const cultureCourseId = courseIds.get('Demo Course Copy')!
    const initialPassword = await bcrypt.hash(
      'local-only-existing-password',
      12
    )

    const [iuw, rsv] = await Promise.all([
      prisma.participant.create({
        data: {
          email: 'existing-iuw@local.invalid',
          username: 'teststudent-iuw',
          password: initialPassword,
          isActive: false,
          isProfilePublic: true,
          participations: {
            create: [
              { courseId: iuwCourseId, isActive: false },
              { courseId: cultureCourseId, isActive: true },
            ],
          },
        },
        select: { id: true },
      }),
      prisma.participant.create({
        data: {
          email: 'existing-rsv@local.invalid',
          username: 'teststudent-rsv',
          password: initialPassword,
          isActive: false,
          isProfilePublic: true,
          participations: {
            create: [
              { courseId: rsvCourseId, isActive: false },
              { courseId: cultureCourseId, isActive: true },
            ],
          },
        },
        select: { id: true },
      }),
    ])

    const first = runScript([APPLY_FLAG], ['IuW', 'RadioSurfVet', 'Culture'])
    expect(first).toContain('mode=apply writes=true')

    const repaired = await prisma.participant.findMany({
      where: { id: { in: [iuw.id, rsv.id] } },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        isActive: true,
        isProfilePublic: true,
        participations: {
          select: { courseId: true, isActive: true },
          orderBy: { courseId: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    })
    expect(repaired).toHaveLength(2)
    for (const participant of repaired) {
      const expectedPassword =
        participant.username === 'teststudent-iuw'
          ? PASSWORDS.IuW
          : PASSWORDS.RadioSurfVet
      expect(await bcrypt.compare(expectedPassword, participant.password)).toBe(
        true
      )
      expect(participant.email).toBe(
        participant.username === 'teststudent-iuw'
          ? 'existing-iuw@local.invalid'
          : 'existing-rsv@local.invalid'
      )
      expect(participant.isActive).toBe(true)
      expect(participant.isProfilePublic).toBe(false)
      expect(participant.participations.filter((p) => p.isActive)).toHaveLength(
        1
      )
    }

    const beforeReplay = repaired
    const replay = runScript([APPLY_FLAG], ['IuW', 'RadioSurfVet', 'Culture'])
    expect(replay).toContain('mode=apply writes=true')
    const afterReplay = await prisma.participant.findMany({
      where: { id: { in: [iuw.id, rsv.id] } },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        isActive: true,
        isProfilePublic: true,
        participations: {
          select: { courseId: true, isActive: true },
          orderBy: { courseId: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    })
    expect(afterReplay).toEqual(beforeReplay)
  }, 30_000)

  it('rolls back all account changes when an SSO collision is present', async () => {
    await cleanupCreatedParticipants()
    const iuwCourseId = courseIds.get('testkurs IuW')!
    const cultureCourseId = courseIds.get('Demo Course Copy')!
    const initialPassword = await bcrypt.hash(
      'local-only-existing-password',
      12
    )

    const iuw = await prisma.participant.create({
      data: {
        username: 'teststudent-iuw',
        password: initialPassword,
        isProfilePublic: false,
        participations: {
          create: { courseId: iuwCourseId, isActive: false },
        },
      },
      select: { id: true },
    })
    const rsv = await prisma.participant.create({
      data: {
        username: 'teststudent-rsv',
        password: initialPassword,
        isProfilePublic: false,
        participations: {
          create: { courseId: iuwCourseId, isActive: true },
        },
      },
      select: { id: true },
    })
    await prisma.participant.create({
      data: {
        username: 'teststudent-culture',
        password: initialPassword,
        isSSOAccount: true,
        participations: {
          create: { courseId: cultureCourseId, isActive: false },
        },
      },
    })

    const output = runFailingScript(
      [APPLY_FLAG],
      ['IuW', 'RadioSurfVet', 'Culture']
    )
    expect(output).toContain('status=failed code=sso_account_Culture')

    const [iuwAfter, rsvAfter] = await Promise.all([
      prisma.participant.findUnique({
        where: { id: iuw.id },
        select: {
          password: true,
          participations: { select: { isActive: true } },
        },
      }),
      prisma.participant.findUnique({
        where: { id: rsv.id },
        select: {
          password: true,
          participations: { select: { isActive: true } },
        },
      }),
    ])
    expect(iuwAfter?.password).toBe(initialPassword)
    expect(iuwAfter?.participations[0]?.isActive).toBe(false)
    expect(rsvAfter?.password).toBe(initialPassword)
    expect(rsvAfter?.participations[0]?.isActive).toBe(true)
  })

  it('requires every password before opening the write transaction', async () => {
    await cleanupCreatedParticipants()

    const output = runFailingScript([APPLY_FLAG], ['IuW', 'Culture'])
    expect(output).toContain('status=failed code=missing_password_RadioSurfVet')
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)
  })

  it('rejects unknown flags without touching the database', async () => {
    await cleanupCreatedParticipants()

    const output = runFailingScript(['--unexpected'])
    expect(output).toContain('status=failed code=unknown_argument')
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)
  })

  it('rejects conflicting modes without touching the database', async () => {
    await cleanupCreatedParticipants()

    const output = runFailingScript(['--apply', '--readback'])
    expect(output).toContain('status=failed code=conflicting_mode')
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)
  })

  it('fails closed when a target course is archived', async () => {
    await cleanupCreatedParticipants()
    const iuwCourseId = courseIds.get('testkurs IuW')!
    await prisma.course.update({
      where: { id: iuwCourseId },
      data: { isArchived: true },
    })

    const output = runFailingScript([])
    expect(output).toContain('status=failed code=target_resolution_IuW')
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)

    await prisma.course.update({
      where: { id: iuwCourseId },
      data: { isArchived: false },
    })
  })

  it('does not alter the shared teststudent account', async () => {
    await cleanupCreatedParticipants()
    const sharedPassword = await bcrypt.hash('local-only-shared-password', 12)
    const shared = await prisma.participant.create({
      data: {
        username: 'teststudent',
        password: sharedPassword,
        isActive: false,
        isProfilePublic: true,
      },
      select: { id: true },
    })

    runScript([APPLY_FLAG], ['IuW', 'RadioSurfVet', 'Culture'])

    const sharedAfter = await prisma.participant.findUnique({
      where: { id: shared.id },
      select: { password: true, isActive: true, isProfilePublic: true },
    })
    expect(sharedAfter).toEqual({
      password: sharedPassword,
      isActive: false,
      isProfilePublic: true,
    })
  })
})
