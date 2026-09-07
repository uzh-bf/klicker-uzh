import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getBetaEnrollment,
  setBetaEnrollment,
} from '../src/services/betaEnrollment.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002'

function createPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }
}

type TestPrisma = ReturnType<typeof createPrisma>

function createContext({
  userId = USER_ID,
  scope = UserLoginScope.FULL_ACCESS,
  catalystInstitutional = true,
  catalystIndividual = false,
  prisma = createPrisma(),
}: {
  userId?: string
  scope?: UserLoginScope
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
  prisma?: TestPrisma
} = {}) {
  const ctx = {
    prisma,
    user: {
      sub: userId,
      role: UserRole.USER,
      scope,
      catalystInstitutional,
      catalystIndividual,
    },
  } as unknown as ContextWithUser

  return { ctx, prisma }
}

describe('beta enrollment service', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    UserLoginScope.FULL_ACCESS,
    UserLoginScope.ACCOUNT_OWNER,
  ])('reads the persisted preference for %s users', async (scope) => {
    const { ctx, prisma } = createContext({ scope })
    prisma.user.findUnique.mockResolvedValue({ betaEnabled: false })

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: true,
      membership: false,
      signupAvailable: true,
    })
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { betaEnabled: true },
    })
  })

  it.each([
    UserLoginScope.READ_ONLY,
    UserLoginScope.SESSION_EXEC,
  ])('hides the persisted preference from %s users', async (scope) => {
    const { ctx, prisma } = createContext({ scope })

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: false,
      membership: null,
      signupAvailable: true,
    })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns an unknown, non-changeable capability for a missing user', async () => {
    const { ctx, prisma } = createContext()
    prisma.user.findUnique.mockResolvedValue(null)

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: false,
      membership: null,
      signupAvailable: true,
    })
  })

  it('returns an unknown, non-changeable capability when the read fails', async () => {
    const { ctx, prisma } = createContext()
    prisma.user.findUnique.mockRejectedValue(new Error())
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: false,
      membership: null,
      signupAvailable: true,
    })
  })

  it('keeps opt-out changeable without Catalyst when persisted membership is true', async () => {
    const { ctx, prisma } = createContext({
      catalystInstitutional: false,
      catalystIndividual: false,
    })
    prisma.user.findUnique.mockResolvedValue({ betaEnabled: true })

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: true,
      membership: true,
      signupAvailable: false,
    })
  })

  it('uses the authenticated actor id for reads and writes', async () => {
    const prisma = createPrisma()
    prisma.user.findUnique.mockResolvedValue({ betaEnabled: true })
    prisma.user.update.mockResolvedValue({ betaEnabled: false })
    const { ctx } = createContext({ userId: OTHER_USER_ID, prisma })

    await getBetaEnrollment({}, ctx)
    await setBetaEnrollment({ enabled: false }, ctx)

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: OTHER_USER_ID },
      select: { betaEnabled: true },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: OTHER_USER_ID },
      data: { betaEnabled: false },
      select: { betaEnabled: true },
    })
  })

  it.each([
    UserLoginScope.FULL_ACCESS,
    UserLoginScope.ACCOUNT_OWNER,
  ])('returns the persisted result and updates for %s users', async (scope) => {
    const { ctx, prisma } = createContext({ scope })
    prisma.user.update.mockResolvedValue({ betaEnabled: false })

    await expect(setBetaEnrollment({ enabled: true }, ctx)).resolves.toEqual({
      mayChange: true,
      membership: false,
      signupAvailable: true,
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { betaEnabled: true },
      select: { betaEnabled: true },
    })
  })

  it('allows opt-out without Catalyst for full-access users', async () => {
    const { ctx, prisma } = createContext({
      catalystInstitutional: false,
      catalystIndividual: false,
    })
    prisma.user.update.mockResolvedValue({ betaEnabled: false })

    await expect(setBetaEnrollment({ enabled: false }, ctx)).resolves.toEqual({
      mayChange: false,
      membership: false,
      signupAvailable: false,
    })
  })

  it('rejects opt-in without Catalyst before writing', async () => {
    const { ctx, prisma } = createContext({
      catalystInstitutional: false,
      catalystIndividual: false,
    })

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it.each([
    UserLoginScope.READ_ONLY,
    UserLoginScope.SESSION_EXEC,
  ])('rejects writes from %s users before touching the database', async (scope) => {
    const { ctx, prisma } = createContext({ scope })

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('coalesces concurrent reads within one request', async () => {
    const { ctx, prisma } = createContext()
    let resolveRead: (value: { betaEnabled: boolean }) => void = () => undefined
    const read = new Promise<{ betaEnabled: boolean }>((resolve) => {
      resolveRead = resolve
    })
    prisma.user.findUnique.mockReturnValue(read)

    const first = getBetaEnrollment({}, ctx)
    const second = getBetaEnrollment({}, ctx)

    expect(prisma.user.findUnique).toHaveBeenCalledOnce()
    resolveRead({ betaEnabled: true })
    await expect(Promise.all([first, second])).resolves.toEqual([
      { mayChange: true, membership: true, signupAvailable: true },
      { mayChange: true, membership: true, signupAvailable: true },
    ])
  })

  it('reads fresh state in a new request context', async () => {
    const prisma = createPrisma()
    prisma.user.findUnique
      .mockResolvedValueOnce({ betaEnabled: false })
      .mockResolvedValueOnce({ betaEnabled: true })
    const firstContext = createContext({ prisma }).ctx
    const secondContext = createContext({ prisma }).ctx

    await expect(getBetaEnrollment({}, firstContext)).resolves.toMatchObject({
      membership: false,
    })
    await expect(getBetaEnrollment({}, secondContext)).resolves.toMatchObject({
      membership: true,
    })
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2)
  })

  it('updates the request cache after a successful write', async () => {
    const { ctx, prisma } = createContext()
    prisma.user.findUnique.mockResolvedValue({ betaEnabled: false })
    prisma.user.update.mockResolvedValue({ betaEnabled: true })

    await getBetaEnrollment({}, ctx)
    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).resolves.toMatchObject({ membership: true })
    await expect(getBetaEnrollment({}, ctx)).resolves.toMatchObject({
      membership: true,
    })
    expect(prisma.user.findUnique).toHaveBeenCalledOnce()
  })

  it('leaves the request cache unchanged after a failed write', async () => {
    const { ctx, prisma } = createContext()
    prisma.user.findUnique.mockResolvedValue({ betaEnabled: false })
    prisma.user.update.mockRejectedValue(new Error())
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await getBetaEnrollment({}, ctx)
    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'BETA_ENROLLMENT_UPDATE_FAILED' },
    })
    await expect(getBetaEnrollment({}, ctx)).resolves.toMatchObject({
      membership: false,
    })
    expect(prisma.user.findUnique).toHaveBeenCalledOnce()
  })
})
