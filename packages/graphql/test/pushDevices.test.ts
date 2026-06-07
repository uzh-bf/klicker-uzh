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
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({ id: 'push-device-id' }),
  }

  return {
    ctx: {
      user: { sub: 'participant-id' },
      prisma: { pushDevice },
    } as any,
    pushDevice,
  }
}

describe('native push device services', () => {
  it('hashes push tokens deterministically without storing raw tokens in unique constraints', () => {
    const hash = getPushDeviceTokenHash('native-token')

    expect(hash).toHaveLength(64)
    expect(hash).toBe(getPushDeviceTokenHash('native-token'))
    expect(hash).not.toBe(getPushDeviceTokenHash('other-token'))
  })

  it('registers a native push device with idempotent token upsert and same-device revocation', async () => {
    const { ctx, pushDevice } = createPushDeviceContext()
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
    expect(pushDevice.updateMany).toHaveBeenCalledWith({
      where: {
        participantId: 'participant-id',
        provider: PushDeviceProvider.FCM,
        deviceId: 'ios-device',
        tokenHash: { not: tokenHash },
      },
      data: {
        enabled: false,
        revokedAt: expect.any(Date),
        lastSeenAt: expect.any(Date),
      },
    })
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
