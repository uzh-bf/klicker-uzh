import { describe, expect, it } from 'vitest'
import {
  getImportExportStartupResponsibilities,
  parseImportExportRuntimeConfig,
} from '../src/lib/importExportRuntimeConfig.js'

const INTEGER_ENV_NAMES = [
  'IMPORT_EXPORT_PACKAGE_TTL_HOURS',
  'IMPORT_EXPORT_PACKAGE_RATE_LIMIT_WINDOW_SECONDS',
  'IMPORT_EXPORT_PACKAGE_PREVIEW_RATE_LIMIT',
  'IMPORT_EXPORT_PACKAGE_EXPORT_RATE_LIMIT',
  'IMPORT_EXPORT_PACKAGE_UPLOAD_RATE_LIMIT',
  'IMPORT_EXPORT_PACKAGE_VALIDATE_RATE_LIMIT',
  'IMPORT_EXPORT_PACKAGE_IMPORT_RATE_LIMIT',
  'IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS',
  'IMPORT_EXPORT_PACKAGE_PREVIEW_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_EXPORT_CONCURRENCY',
  'IMPORT_EXPORT_PACKAGE_EXPORT_GLOBAL_CONCURRENCY',
  'IMPORT_EXPORT_UPLOAD_BODY_TIMEOUT_MS',
  'IMPORT_EXPORT_AZURE_METADATA_TIMEOUT_MS',
  'IMPORT_EXPORT_AZURE_TRANSFER_TIMEOUT_MS',
] as const

function productionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    IMPORT_EXPORT_PACKAGE_STORAGE: 'azure',
    ...overrides,
  }
}

describe('import/export runtime configuration', () => {
  it('uses the approved immutable defaults and hard-disables assessment', () => {
    const normal = parseImportExportRuntimeConfig(productionEnv())
    expect(normal.enabled).toBe(false)
    expect(normal.privatePreviewOnly).toBe(true)
    expect(normal.packageTtlHours).toBe(24)
    expect(normal.rateLimitWindowSeconds).toBe(900)
    expect(normal.rateLimits).toEqual({
      preview: 30,
      export: 30,
      upload: 30,
      validate: 30,
      import: 5,
    })
    expect(Object.isFrozen(normal)).toBe(true)
    expect(Object.isFrozen(normal.rateLimits)).toBe(true)
    expect(normal.concurrency).toEqual({
      leaseTtlMs: 120_000,
      previewPerUser: 2,
      previewGlobal: 8,
      uploadPerUser: 1,
      uploadGlobal: 4,
      validatePerUser: 2,
      validateGlobal: 8,
      importPerUser: 1,
      importGlobal: 4,
      exportPerUser: 2,
      exportGlobal: 8,
    })

    const assessment = parseImportExportRuntimeConfig(
      productionEnv({
        ASSESSMENT_MODE: 'true',
        IMPORT_EXPORT_ENABLED: 'true',
      })
    )
    expect(assessment.assessmentMode).toBe(true)
    expect(assessment.enabled).toBe(false)

    const development = parseImportExportRuntimeConfig({
      NODE_ENV: 'development',
      IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
    })
    expect(development.privatePreviewOnly).toBe(false)
  })

  it('honors explicit private-preview-only configuration', () => {
    expect(
      parseImportExportRuntimeConfig(
        productionEnv({ IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY: 'false' })
      ).privatePreviewOnly
    ).toBe(false)
    expect(
      parseImportExportRuntimeConfig({
        NODE_ENV: 'development',
        IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
        IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY: 'true',
      }).privatePreviewOnly
    ).toBe(true)
  })

  it('rejects validation concurrency when the global limit is below the user limit', () => {
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({
          IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY: '3',
          IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY: '2',
        })
      )
    ).toThrow('IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY')
  })

  it('rejects upload concurrency when the global limit is below the user limit', () => {
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({
          IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY: '3',
          IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY: '2',
        })
      )
    ).toThrow('IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY')
  })

  it('rejects import concurrency when the global limit is below the user limit', () => {
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({
          IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY: '3',
          IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY: '2',
        })
      )
    ).toThrow('IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY')
  })

  it.each([
    'IMPORT_EXPORT_ENABLED',
    'IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY',
    'ASSESSMENT_MODE',
  ])('rejects malformed boolean %s', (name) => {
    expect(() =>
      parseImportExportRuntimeConfig(productionEnv({ [name]: 'TRUE' }))
    ).toThrow(name)
    expect(() =>
      parseImportExportRuntimeConfig(productionEnv({ [name]: '' }))
    ).toThrow(name)
  })

  it('rejects a malformed enabled gate even when assessment mode disables the feature', () => {
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({
          ASSESSMENT_MODE: 'true',
          IMPORT_EXPORT_ENABLED: 'TRUE',
        })
      )
    ).toThrow('IMPORT_EXPORT_ENABLED')
  })

  it.each(
    INTEGER_ENV_NAMES
  )('rejects empty, noncanonical, nonpositive, fractional, and unsafe %s', (name) => {
    for (const value of ['', '01', '0', '-1', '1.5', '9007199254740992']) {
      expect(() =>
        parseImportExportRuntimeConfig(productionEnv({ [name]: value }))
      ).toThrow(name)
    }
  })

  it('enforces policy maxima and cross-field invariants', () => {
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({ IMPORT_EXPORT_PACKAGE_TTL_HOURS: '49' })
      )
    ).toThrow('IMPORT_EXPORT_PACKAGE_TTL_HOURS')
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({
          IMPORT_EXPORT_PACKAGE_PREVIEW_CONCURRENCY: '3',
          IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY: '2',
        })
      )
    ).toThrow('IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY')
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({
          IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS: '2999',
        })
      )
    ).toThrow('IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS')
  })

  it('allows local storage only in development/test', () => {
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({ IMPORT_EXPORT_PACKAGE_STORAGE: 'local' })
      )
    ).toThrow('IMPORT_EXPORT_PACKAGE_STORAGE')
    expect(
      parseImportExportRuntimeConfig({
        NODE_ENV: 'test',
        IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
      }).packageStorage
    ).toBe('local')
    expect(() =>
      parseImportExportRuntimeConfig(
        productionEnv({ IMPORT_EXPORT_PACKAGE_STORAGE: '' })
      )
    ).toThrow('IMPORT_EXPORT_PACKAGE_STORAGE')
  })

  it.each([
    {
      role: 'backend' as const,
      env: {},
      expected: [false, false, false, false],
    },
    {
      role: 'backend' as const,
      env: { IMPORT_EXPORT_ENABLED: 'true' },
      expected: [true, false, true, true],
    },
    {
      role: 'backend' as const,
      env: { ASSESSMENT_MODE: 'true', IMPORT_EXPORT_ENABLED: 'true' },
      expected: [false, false, false, false],
    },
    {
      role: 'general-worker' as const,
      env: {},
      expected: [false, true, true, false],
    },
    {
      role: 'general-worker' as const,
      env: { IMPORT_EXPORT_ENABLED: 'true' },
      expected: [false, true, true, false],
    },
    {
      role: 'general-worker' as const,
      env: { ASSESSMENT_MODE: 'true', IMPORT_EXPORT_ENABLED: 'true' },
      expected: [false, false, false, false],
    },
  ])('assigns $role startup responsibilities for $env', ({
    role,
    env,
    expected,
  }) => {
    const responsibilities = getImportExportStartupResponsibilities(
      role,
      parseImportExportRuntimeConfig(productionEnv(env))
    )
    expect([
      responsibilities.userOperations,
      responsibilities.maintenance,
      responsibilities.requiresPackageStorage,
      responsibilities.requiresTokenSecret,
    ]).toEqual(expected)
    expect(Object.isFrozen(responsibilities)).toBe(true)
  })
})
