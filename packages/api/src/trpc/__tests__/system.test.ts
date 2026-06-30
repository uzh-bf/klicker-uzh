import { describe, expect, test } from 'vitest'
import { appRouter } from '../root.js'

describe('system router', () => {
  test('returns the tRPC health payload', async () => {
    const caller = appRouter.createCaller({})
    const result = await caller.system.health()

    expect(result).toEqual({ api: 'trpc', status: 'ok' })
  })
})
