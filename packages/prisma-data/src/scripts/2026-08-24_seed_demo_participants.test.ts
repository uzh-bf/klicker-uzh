import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import bcrypt from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const DATABASE_URL = process.env.TEST_DATABASE_URL
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

;(DATABASE_URL ? describe : describe.skip)('seed demo participants', () => {
  const adapter = new PrismaPg({ connectionString: DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  let ownerId = ''
  const courseIds = new Map<string, string>()

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: {
        email: 'demo-participant-owner@local.invalid',
        shortname: 'klick',
      },
      select: { id: true },
    })
    ownerId = owner.id

    for (const [index, [courseName, chatbotName]] of [
      ['testkurs IuW', 'Informatik und Wirtschaft'],
      ['testkurs RadioSurfVet', 'RadioSurfVet'],
      ['KlickerUZH Demo Copy', 'Culture Scenario Lab'],
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

  afterAll(async () => {
    await prisma.participant.deleteMany({
      where: { username: { in: USERNAMES } },
    })
    await prisma.course.deleteMany({ where: { ownerId } })
    await prisma.user.delete({ where: { id: ownerId } }).catch(() => undefined)
    await prisma.$disconnect()
  })

  it('defaults to a values-free no-write dry run and supports readback', async () => {
    await prisma.participant.deleteMany({
      where: { username: { in: USERNAMES } },
    })

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

    const readback = runScript(['--readback'])
    expect(readback).toContain('mode=readback writes=false')
    expect(USERNAMES.some((username) => readback.includes(username))).toBe(
      false
    )
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)
  })

  it('creates all three accounts and replays as a database no-op', async () => {
    await prisma.participant.deleteMany({
      where: { username: { in: USERNAMES } },
    })

    const first = runScript([APPLY_FLAG], ['IuW', 'RadioSurfVet', 'Culture'])
    expect(first).toContain('mode=apply writes=true')
    expect(first).toContain('target=Culture accountActive=true')
    expect(first).toContain('passwordMatches=true')
    expect(
      Object.values(PASSWORDS).some((password) => first.includes(password))
    ).toBe(false)

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
  })

  it('rolls back all account changes when an SSO collision is present', async () => {
    await prisma.participant.deleteMany({
      where: { username: { in: USERNAMES } },
    })
    const iuwCourseId = courseIds.get('testkurs IuW')!
    const cultureCourseId = courseIds.get('KlickerUZH Demo Copy')!
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
    await prisma.participant.deleteMany({
      where: { username: { in: USERNAMES } },
    })

    const output = runFailingScript([APPLY_FLAG], ['IuW', 'Culture'])
    expect(output).toContain('status=failed code=missing_password_RadioSurfVet')
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)
  })

  it('rejects unknown flags without touching the database', async () => {
    await prisma.participant.deleteMany({
      where: { username: { in: USERNAMES } },
    })

    const output = runFailingScript(['--unexpected'])
    expect(output).toContain('status=failed code=unknown_argument')
    expect(
      await prisma.participant.count({
        where: { username: { in: USERNAMES } },
      })
    ).toBe(0)
  })
})
