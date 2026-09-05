import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { graphql } from 'graphql/index.js'
import { schema } from '../src/index.js'
import {
  getElementExportPackageLink,
  getElementExportPackagePreview,
  importElementPackage,
  prepareElementImportPackageUpload,
  validateElementImportPackage,
} from '../src/services/elementImportExport.js'
import {
  assertCanUseElementImportExport,
  canUseElementImportExport,
  getElementImportExportCapability,
  IMPORT_EXPORT_DISABLED_ERROR_CODE,
} from '../src/services/importExportAuthorization.js'

const originalEnv = {
  enabled: process.env.IMPORT_EXPORT_ENABLED,
  previewOnly: process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY,
  assessment: process.env.ASSESSMENT_MODE,
}

function restoreEnvironment() {
  for (const [name, value] of [
    ['IMPORT_EXPORT_ENABLED', originalEnv.enabled],
    ['IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY', originalEnv.previewOnly],
    ['ASSESSMENT_MODE', originalEnv.assessment],
  ] as const) {
    if (typeof value === 'undefined') delete process.env[name]
    else process.env[name] = value
  }
}

function createContext({
  role = UserRole.USER,
  scope = UserLoginScope.FULL_ACCESS,
  privatePreview = true,
}: {
  role?: UserRole
  scope?: UserLoginScope
  privatePreview?: boolean
} = {}) {
  return {
    user: {
      sub: 'user-1',
      role,
      scope,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: {
      user: {
        findUnique: vi.fn(async () => ({ privatePreview })),
      },
    },
  } as any
}

describe('import/export runtime authorization', () => {
  beforeEach(() => {
    process.env.IMPORT_EXPORT_ENABLED = 'true'
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'false'
    delete process.env.ASSESSMENT_MODE
  })

  afterEach(restoreEnvironment)

  it.each([
    UserLoginScope.ACCOUNT_OWNER,
    UserLoginScope.FULL_ACCESS,
  ])('admits full authoring scope %s', async (scope) => {
    await expect(
      canUseElementImportExport(createContext({ scope }))
    ).resolves.toBe(true)
  })

  it('admits an administrator with full authoring scope', async () => {
    await expect(
      canUseElementImportExport(createContext({ role: UserRole.ADMIN }))
    ).resolves.toBe(true)
  })

  it.each([
    UserLoginScope.SESSION_EXEC,
    UserLoginScope.READ_ONLY,
    UserLoginScope.OTP,
    UserLoginScope.ACTIVATION,
    UserLoginScope.EDUID,
  ])('denies restricted scope %s', async (scope) => {
    await expect(
      canUseElementImportExport(createContext({ scope }))
    ).resolves.toBe(false)
  })

  it('uses the persisted private-preview flag when required', async () => {
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'true'

    await expect(
      canUseElementImportExport(createContext({ privatePreview: true }))
    ).resolves.toBe(true)
    await expect(
      canUseElementImportExport(createContext({ privatePreview: false }))
    ).resolves.toBe(false)
  })

  it('treats a missing preview user like any other denial', async () => {
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'true'
    const ctx = createContext()
    ctx.prisma.user.findUnique.mockResolvedValue(null)

    await expect(canUseElementImportExport(ctx)).resolves.toBe(false)
    await expect(assertCanUseElementImportExport(ctx)).rejects.toMatchObject({
      message: 'Import/export is not available.',
      extensions: { code: IMPORT_EXPORT_DISABLED_ERROR_CODE },
    })
  })

  it('does not convert a private-preview database outage into access', async () => {
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'true'
    const ctx = createContext()
    const databaseError = new Error('database unavailable')
    ctx.prisma.user.findUnique.mockRejectedValue(databaseError)

    await expect(canUseElementImportExport(ctx)).rejects.toBe(databaseError)
  })

  it('fails the profile capability closed without exposing lookup failures', async () => {
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'true'
    const ctx = createContext()
    const sensitiveMessage = 'postgres.internal/private-preview-table'
    ctx.prisma.user.findUnique.mockRejectedValue(new Error(sensitiveMessage))
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined)

    await expect(getElementImportExportCapability(ctx)).resolves.toBe(false)
    expect(consoleInfo).toHaveBeenCalledWith(
      '[ImportExportTelemetry]',
      expect.stringContaining('"code":"CAPABILITY_LOOKUP_FAILED"')
    )
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain(
      sensitiveMessage
    )

    consoleInfo.mockRestore()
  })

  it('fails before a user lookup when the process or scope is disabled', async () => {
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'true'
    process.env.IMPORT_EXPORT_ENABLED = 'false'
    const disabledContext = createContext()
    await expect(canUseElementImportExport(disabledContext)).resolves.toBe(
      false
    )
    expect(disabledContext.prisma.user.findUnique).not.toHaveBeenCalled()

    process.env.IMPORT_EXPORT_ENABLED = 'true'
    const restrictedContext = createContext({
      scope: UserLoginScope.READ_ONLY,
    })
    await expect(canUseElementImportExport(restrictedContext)).resolves.toBe(
      false
    )
    expect(restrictedContext.prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('uses one privacy-neutral error for all denials', async () => {
    process.env.ASSESSMENT_MODE = 'true'

    await expect(
      assertCanUseElementImportExport(createContext())
    ).rejects.toMatchObject({
      message: 'Import/export is not available.',
      extensions: { code: IMPORT_EXPORT_DISABLED_ERROR_CODE },
    })
  })

  it('exposes a false capability to restricted users without authorizing operations', async () => {
    const restricted = await graphql({
      schema,
      source: 'query { canUseElementImportExport }',
      contextValue: createContext({ scope: UserLoginScope.READ_ONLY }),
    })
    expect(restricted.errors).toBeUndefined()
    expect(restricted.data).toEqual({ canUseElementImportExport: false })

    const fullAccess = await graphql({
      schema,
      source: 'query { canUseElementImportExport }',
      contextValue: createContext(),
    })
    expect(fullAccess.errors).toBeUndefined()
    expect(fullAccess.data).toEqual({ canUseElementImportExport: true })
  })

  it('does not expose the capability to participant callers', async () => {
    const result = await graphql({
      schema,
      source: 'query { canUseElementImportExport }',
      contextValue: createContext({ role: UserRole.PARTICIPANT }),
    })

    expect(result.data).toBeNull()
    expect(result.errors?.[0]?.message).toMatch(/unauthorized/i)
  })

  it('gates every facade before rate limiting, domain reads, or storage', async () => {
    process.env.IMPORT_EXPORT_ENABLED = 'false'
    const ctx = createContext()
    ctx.redisExec = { eval: vi.fn() }
    ctx.prisma.element = { findMany: vi.fn() }

    const operations = [
      () => getElementExportPackageLink({ elementIds: [1] }, ctx),
      () => getElementExportPackagePreview({ elementIds: [1] }, ctx),
      () =>
        prepareElementImportPackageUpload(
          { filename: 'package.zip', bytes: 1024 },
          ctx
        ),
      () =>
        validateElementImportPackage(
          { artifactId: '00000000-0000-4000-8000-000000000001' },
          ctx
        ),
      () =>
        importElementPackage(
          { importToken: 'invalid', selectedElementRefs: ['element-1'] },
          ctx
        ),
    ]

    for (const operation of operations) {
      await expect(operation()).rejects.toMatchObject({
        extensions: { code: IMPORT_EXPORT_DISABLED_ERROR_CODE },
      })
    }

    expect(ctx.redisExec.eval).not.toHaveBeenCalled()
    expect(ctx.prisma.user.findUnique).not.toHaveBeenCalled()
    expect(ctx.prisma.element.findMany).not.toHaveBeenCalled()
  })
})
