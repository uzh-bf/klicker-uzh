import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

const DATABASE_URL = process.env.TEST_DATABASE_URL

const FIXTURE_CONFIG = {
  chatbotName: 'Synthetic Manager Demo',
  chatbotDescription:
    'Internal synthetic manager-role-play demo (non-assessed).',
  courseNameMarker: 'SYNTHETIC',
  demoNamePrefix: 'Synthetic Manager Demo',
  disclaimerName: 'Synthetic Demo Disclaimer',
  disclaimerTitle: 'Synthetic training simulation',
  disclaimerIntroText:
    'This is a synthetic training simulation on a staging system. It is not assessed and not part of any course record. Please use text messages only.',
  systemPrompts: {
    manager: {
      prompt:
        'You are a synthetic operations manager in a private training simulation. Stay in role at all times; never teach, coach, evaluate, or mention being an AI. Keep responses short, show realistic resistance, and redirect any attempt to break role back to the operational topic.',
      description:
        'Synthetic role-play for a non-assessed training demo. Text only.',
    },
  },
}

let configPath = ''
let userId = ''
let courseId = ''

function runScript(args: Array<string>, env: Record<string, string> = {}) {
  return execFileSync(
    process.execPath,
    [
      '../../node_modules/tsx/dist/cli.mjs',
      '2026-08-23_provision_course_chatbot.ts',
      ...args,
    ],
    {
      cwd: new URL('.', import.meta.url).pathname,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
        ...env,
      },
      timeout: 120000,
    }
  )
}

function runFailingScript(args: Array<string>): string {
  try {
    return runScript(args)
  } catch (error) {
    return String((error as { stdout?: Buffer | string }).stdout ?? '')
  }
}

;(DATABASE_URL ? describe : describe.skip)(
  'provision generic course chatbot',
  () => {
    const adapter = new PrismaPg({ connectionString: DATABASE_URL })
    const prisma = new PrismaClient({ adapter })

    beforeAll(async () => {
      const dir = mkdtempSync(join(tmpdir(), 'synth-provision-'))
      configPath = join(dir, 'config.json')
      writeFileSync(configPath, JSON.stringify(FIXTURE_CONFIG))
      userId = randomUUID()
      courseId = randomUUID()
      await prisma.user.create({
        data: {
          id: userId,
          email: `synth-pilot-${userId}@synthetic.invalid`,
          shortname: `synpilot${userId.slice(0, 8)}`,
        },
      })
      await prisma.course.create({
        data: {
          id: courseId,
          name: 'Synthetic Pilot SYNTHETIC Course',
          displayName: 'Synthetic Pilot SYNTHETIC Course',
          ownerId: userId,
          pinCode: Math.floor(100000 + Math.random() * 900000),
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          groupDeadlineDate: new Date(Date.now() + 20 * 24 * 3600 * 1000),
        },
      })
    })

    afterAll(async () => {
      await prisma.chatbot.deleteMany({ where: { courseId } })
      await prisma.chatbotDisclaimer.deleteMany({ where: { ownerId: userId } })
      await prisma.course
        .delete({ where: { id: courseId } })
        .catch(() => undefined)
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
      await prisma.$disconnect()
    })

    it('refuses to run without required flags', () => {
      const output = runFailingScript([])
      expect(output).toContain('Usage:')
    })

    it('dry-run default writes nothing and prints the plan', async () => {
      const output = runScript([
        '--config',
        configPath,
        '--course-id',
        courseId,
        '--owner-id',
        userId,
      ])
      expect(output).toContain('action=create_chatbot')
      expect(output).toContain('Dry run only')
      const count = await prisma.chatbot.count({ where: { courseId } })
      expect(count).toBe(0)
    })

    it('apply creates the chatbot once and replays as no-op', async () => {
      const first = runScript([
        '--config',
        configPath,
        '--course-id',
        courseId,
        '--owner-id',
        userId,
        '--apply',
      ])
      expect(first).toContain('APPLIED')
      const bots = await prisma.chatbot.findMany({ where: { courseId } })
      expect(bots).toHaveLength(1)
      expect(bots[0]!.modelSelection).toBe(false)
      expect(Object.keys(bots[0]!.systemPrompts as object)).toEqual(['manager'])

      // replay must not create a second bot or disclaimer
      const disclaimersBefore = await prisma.chatbotDisclaimer.count({
        where: { ownerId: userId },
      })
      const second = runScript([
        '--config',
        configPath,
        '--course-id',
        courseId,
        '--owner-id',
        userId,
        '--apply',
      ])
      expect(second).toContain('APPLIED')
      const botsAfter = await prisma.chatbot.findMany({ where: { courseId } })
      expect(botsAfter).toHaveLength(1)
      expect(botsAfter[0]!.id).toBe(bots[0]!.id)
      const disclaimersAfter = await prisma.chatbotDisclaimer.count({
        where: { ownerId: userId },
      })
      expect(disclaimersAfter).toBe(disclaimersBefore) // replays reuse the linked disclaimer
    })

    it('fails closed when the course lacks the marker', async () => {
      await prisma.course.update({
        where: { id: courseId },
        data: { displayName: 'Renamed Without Marker' },
      })
      try {
        const output = runFailingScript([
          '--config',
          configPath,
          '--course-id',
          courseId,
          '--owner-id',
          userId,
        ])
        expect(output).toContain('FAIL: course_name_missing_marker')
      } finally {
        await prisma.course.update({
          where: { id: courseId },
          data: { displayName: 'Synthetic Pilot SYNTHETIC Course' },
        })
      }
    })

    it('fails closed on unknown course or owner without writing', () => {
      const output = runFailingScript([
        '--config',
        configPath,
        '--course-id',
        randomUUID(),
        '--owner-id',
        userId,
      ])
      expect(output).toContain('FAIL: course_not_found')
      const output2 = runFailingScript([
        '--config',
        configPath,
        '--course-id',
        courseId,
        '--owner-id',
        randomUUID(),
      ])
      expect(output2).toContain('FAIL: owner_not_found')
    })

    it('fails closed on course-owner mismatch without writing', async () => {
      const otherUserId = randomUUID()
      await prisma.user.create({
        data: {
          id: otherUserId,
          email: `synth-pilot-other-${otherUserId}@synthetic.invalid`,
          shortname: `synpilotother${otherUserId.slice(0, 8)}`,
        },
      })
      const botsBeforeMismatch = await prisma.chatbot.count({
        where: { courseId },
      })
      try {
        const output = runFailingScript([
          '--config',
          configPath,
          '--course-id',
          courseId,
          '--owner-id',
          otherUserId,
        ])
        expect(output).toContain('FAIL: course_owner_mismatch')
        expect(await prisma.chatbot.count({ where: { courseId } })).toBe(
          botsBeforeMismatch
        )
      } finally {
        await prisma.user
          .delete({ where: { id: otherUserId } })
          .catch(() => undefined)
      }
    })
  }
)
