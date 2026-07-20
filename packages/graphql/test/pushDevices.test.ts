import {
  Locale,
  PushDevicePlatform,
  PushDeviceProvider,
} from '@klicker-uzh/prisma/client'
import {
  getPushDeviceTokenHash,
  registerPushDevice,
  revokePushDevice,
} from '../src/services/notifications.js'

function createPushDeviceContext() {
  const pushDevice = {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({ id: 'push-device-id' }),
  }

  const prisma = {
    pushDevice,
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    ),
  }

  return {
    ctx: {
      user: { sub: 'participant-id' },
      prisma,
    } as any,
    pushDevice,
    prisma,
  }
}

describe('native push device services', () => {
  it('hashes push tokens deterministically without storing raw tokens in unique constraints', () => {
    const hash = getPushDeviceTokenHash('native-token')

    expect(hash).toHaveLength(64)
    expect(hash).toBe(getPushDeviceTokenHash('native-token'))
    expect(hash).not.toBe(getPushDeviceTokenHash('other-token'))
  })

  it('registers a device with a stable deviceId by deleting stale token rows and upserting atomically', async () => {
    const { ctx, pushDevice, prisma } = createPushDeviceContext()
    const tokenHash = getPushDeviceTokenHash('native-token')

    const result = await registerPushDevice(
      {
        token: ' native-token ',
        platform: PushDevicePlatform.IOS,
        appId: 'ch.uzh.bf.klicker.pwa',
        appVersion: '1.0.0',
        deviceId: ' ios-device ',
        locale: Locale.en,
      },
      ctx
    )

    expect(result).toEqual({ id: 'push-device-id' })

    // The delete + upsert must run inside a single transaction so token rotation
    // on a stable deviceId never leaves the composite unique key half-updated.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)

    // Stale rows for the same physical device (any other token) are deleted so the
    // upsert can (re)claim the @@unique([participantId, provider, deviceId]) key
    // instead of colliding (P2002). Soft-revoke is no longer used here.
    expect(pushDevice.deleteMany).toHaveBeenCalledWith({
      where: {
        participantId: 'participant-id',
        provider: PushDeviceProvider.FCM,
        deviceId: 'ios-device',
        tokenHash: { not: tokenHash },
      },
    })
    expect(pushDevice.updateMany).not.toHaveBeenCalled()

    expect(pushDevice.upsert).toHaveBeenCalledWith({
      where: { tokenHash },
      create: expect.objectContaining({
        token: 'native-token',
        tokenHash,
        platform: PushDevicePlatform.IOS,
        provider: PushDeviceProvider.FCM,
        appId: 'ch.uzh.bf.klicker.pwa',
        appVersion: '1.0.0',
        deviceId: 'ios-device',
        locale: Locale.en,
        enabled: true,
        participant: { connect: { id: 'participant-id' } },
      }),
      update: expect.objectContaining({
        token: 'native-token',
        platform: PushDevicePlatform.IOS,
        provider: PushDeviceProvider.FCM,
        appId: 'ch.uzh.bf.klicker.pwa',
        appVersion: '1.0.0',
        deviceId: 'ios-device',
        locale: Locale.en,
        enabled: true,
        revokedAt: null,
        participant: { connect: { id: 'participant-id' } },
      }),
    })
  })

  it('registers a device without a deviceId via a plain upsert (no transaction, no delete)', async () => {
    const { ctx, pushDevice, prisma } = createPushDeviceContext()
    const tokenHash = getPushDeviceTokenHash('native-token')

    const result = await registerPushDevice(
      {
        token: 'native-token',
        platform: PushDevicePlatform.ANDROID,
      },
      ctx
    )

    expect(result).toEqual({ id: 'push-device-id' })

    // Null deviceId rows never collide on the composite unique (PostgreSQL
    // NULLS DISTINCT), so no delete/transaction is needed.
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(pushDevice.deleteMany).not.toHaveBeenCalled()
    expect(pushDevice.updateMany).not.toHaveBeenCalled()

    expect(pushDevice.upsert).toHaveBeenCalledWith({
      where: { tokenHash },
      create: expect.objectContaining({
        tokenHash,
        deviceId: null,
        provider: PushDeviceProvider.FCM,
      }),
      update: expect.objectContaining({
        deviceId: null,
        provider: PushDeviceProvider.FCM,
      }),
    })
  })

  it('revokes only the authenticated participants matching enabled token', async () => {
    const { ctx, pushDevice } = createPushDeviceContext()
    pushDevice.updateMany.mockResolvedValueOnce({ count: 1 })

    await expect(
      revokePushDevice({ token: ' native-token ' }, ctx)
    ).resolves.toBe(true)

    expect(pushDevice.updateMany).toHaveBeenCalledWith({
      where: {
        participantId: 'participant-id',
        tokenHash: getPushDeviceTokenHash('native-token'),
        enabled: true,
      },
      data: {
        enabled: false,
        revokedAt: expect.any(Date),
      },
    })
  })

  it('does not revoke an empty token', async () => {
    const { ctx, pushDevice } = createPushDeviceContext()

    await expect(revokePushDevice({ token: ' ' }, ctx)).resolves.toBe(false)
    expect(pushDevice.updateMany).not.toHaveBeenCalled()
  })
})
