import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { deleteParticipantAccount } from '../src/services/accounts.js'

afterEach(() => vi.unstubAllEnvs())

describe('assessment account retention', () => {
  it('rejects direct self-deletion before accessing records or clearing cookies', async () => {
    vi.stubEnv('ASSESSMENT_MODE', 'true')
    const findUnique = vi.fn()
    const cookie = vi.fn()
    const context = {
      prisma: { participant: { findUnique } },
      res: { cookie },
    } as unknown as ContextWithUser

    await expect(deleteParticipantAccount(context)).resolves.toBe(false)
    expect(findUnique).not.toHaveBeenCalled()
    expect(cookie).not.toHaveBeenCalled()
  })
})
