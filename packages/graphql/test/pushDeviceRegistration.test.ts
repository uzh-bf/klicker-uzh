import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  PrismaClient,
  PushDevicePlatform,
  PushDeviceProvider,
} from '@klicker-uzh/prisma/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getPushDeviceTokenHash,
  registerPushDevice,
} from '../src/services/notifications.js'

// Live-DB harness (mirrors accountLtiLinking.test.ts): a real PrismaClient against
// the test Postgres, self-contained test data scoped by a per-run prefix.
const TEST_PREFIX = `push-device-${Date.now()}`

let prisma: PrismaClient

function ctxFor(participantId: string): ContextWithUser {
  return {
    prisma,
    user: { sub: participantId },
  } as unknown as ContextWithUser
}

async function createParticipant(label: string) {
  return prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`.slice(0, 48),
      password: 'not-used-in-these-tests',
    },
  })
}

async function countDeviceRows(participantId: string, deviceId: string | null) {
  return prisma.pushDevice.count({
    where: {
      participantId,
      provider: PushDeviceProvider.FCM,
      deviceId,
    },
  })
}

async function cleanupTestData() {
  const participants = await prisma.participant.findMany({
    where: { username: { startsWith: TEST_PREFIX } },
    select: { id: true },
  })
  const participantIds = participants.map((participant) => participant.id)

  if (participantIds.length > 0) {
    await prisma.pushDevice.deleteMany({
      where: { participantId: { in: participantIds } },
    })
    await prisma.participant.deleteMany({
      where: { id: { in: participantIds } },
    })
  }
}

describe('push device registration (live DB)', () => {
  beforeAll(async () => {
    prisma = prismaClient
    await prisma.$connect()
    await cleanupTestData()
  }, 60000)

  afterEach(async () => {
    await cleanupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  }, 60000)

  it('rotates the token of a stable device without a P2002 composite-key collision', async () => {
    const participant = await createParticipant('rotation')
    const ctx = ctxFor(participant.id)
    const deviceId = 'ios-device'
    const oldHash = getPushDeviceTokenHash(`${TEST_PREFIX}-token-1`)
    const newHash = getPushDeviceTokenHash(`${TEST_PREFIX}-token-2`)

    const first = await registerPushDevice(
      {
        token: `${TEST_PREFIX}-token-1`,
        platform: PushDevicePlatform.IOS,
        deviceId,
      },
      ctx
    )
    expect(first.tokenHash).toBe(oldHash)
    expect(first.deviceId).toBe(deviceId)
    expect(first.enabled).toBe(true)
    expect(await countDeviceRows(participant.id, deviceId)).toBe(1)

    // Same physical device, new token. Before the fix this threw P2002 on
    // @@unique([participantId, provider, deviceId]) because the soft-revoked old
    // row still occupied the composite key. Must now resolve cleanly.
    const rotated = await registerPushDevice(
      {
        token: `${TEST_PREFIX}-token-2`,
        platform: PushDevicePlatform.IOS,
        deviceId,
      },
      ctx
    )

    expect(rotated.tokenHash).toBe(newHash)
    expect(rotated.deviceId).toBe(deviceId)
    expect(rotated.enabled).toBe(true)

    // Exactly one active row for the device, carrying the new token.
    expect(await countDeviceRows(participant.id, deviceId)).toBe(1)
    const active = await prisma.pushDevice.findFirst({
      where: { participantId: participant.id, deviceId },
    })
    expect(active?.tokenHash).toBe(newHash)
    expect(active?.enabled).toBe(true)

    // The stale token row is gone (deleted, not left dangling/soft-revoked).
    const stale = await prisma.pushDevice.findUnique({
      where: { tokenHash: oldHash },
    })
    expect(stale).toBeNull()
  })

  it('keeps a single row across repeated rotations and idempotent re-registration', async () => {
    const participant = await createParticipant('repeat')
    const ctx = ctxFor(participant.id)
    const deviceId = 'android-device'

    for (const suffix of ['a', 'b', 'c']) {
      await registerPushDevice(
        {
          token: `${TEST_PREFIX}-rot-${suffix}`,
          platform: PushDevicePlatform.ANDROID,
          deviceId,
        },
        ctx
      )
    }

    // Re-registering the current token must be idempotent (upsert UPDATE branch).
    const finalHash = getPushDeviceTokenHash(`${TEST_PREFIX}-rot-c`)
    const again = await registerPushDevice(
      {
        token: `${TEST_PREFIX}-rot-c`,
        platform: PushDevicePlatform.ANDROID,
        deviceId,
      },
      ctx
    )

    expect(again.tokenHash).toBe(finalHash)
    expect(again.enabled).toBe(true)
    expect(await countDeviceRows(participant.id, deviceId)).toBe(1)
  })

  it('does not deduplicate rows that omit a deviceId (PostgreSQL NULLS DISTINCT — out of scope)', async () => {
    const participant = await createParticipant('null-device')
    const ctx = ctxFor(participant.id)

    await registerPushDevice(
      {
        token: `${TEST_PREFIX}-null-1`,
        platform: PushDevicePlatform.WEB,
      },
      ctx
    )
    await registerPushDevice(
      {
        token: `${TEST_PREFIX}-null-2`,
        platform: PushDevicePlatform.WEB,
      },
      ctx
    )

    // Two distinct rows: null deviceId never collides on the composite unique, so
    // the fix intentionally leaves this path (B3 accumulation) untouched.
    expect(await countDeviceRows(participant.id, null)).toBe(2)
  })
})
