import {
  MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS,
  MAX_IMPORT_EXPORT_ELEMENTS,
  MAX_IMPORT_EXPORT_MEDIA_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_FILES,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS,
  MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACT_BYTES,
  MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS,
} from './importExportPackageConfig.js'

const MAX_PACKAGE_TTL_HOURS = 48

type ImportExportPackageStorage = 'azure' | 'local'

export type ImportExportRuntimeConfig = Readonly<{
  assessmentMode: boolean
  enabled: boolean
  privatePreviewOnly: boolean
  packageStorage: ImportExportPackageStorage
  packageTtlHours: number
  rateLimitWindowSeconds: number
  rateLimits: Readonly<{
    preview: number
    export: number
    upload: number
    validate: number
    import: number
  }>
  concurrency: Readonly<{
    leaseTtlMs: number
    previewPerUser: number
    previewGlobal: number
    uploadPerUser: number
    uploadGlobal: number
    validatePerUser: number
    validateGlobal: number
    importPerUser: number
    importGlobal: number
    exportPerUser: number
    exportGlobal: number
  }>
  timeouts: Readonly<{
    uploadBodyMs: number
    azureMetadataMs: number
    azureTransferMs: number
  }>
  limits: Readonly<{
    packageBytes: number
    elements: number
    answerCollections: number
    answerCollectionEntries: number
    totalAnswerCollectionEntries: number
    selectedAnswerCollectionItems: number
    mediaFiles: number
    mediaBytes: number
    unexpiredArtifacts: number
    unexpiredArtifactBytes: number
  }>
}>

export type ImportExportProcessRole = 'backend' | 'general-worker'

export type ImportExportStartupResponsibilities = Readonly<{
  userOperations: boolean
  maintenance: boolean
  requiresPackageStorage: boolean
  requiresTokenSecret: boolean
}>

type IntegerRule = Readonly<{
  name: string
  fallback: number
  minimum: number
  maximum: number
}>

function readBoolean(env: NodeJS.ProcessEnv, name: string, fallback: boolean) {
  const value = env[name]
  if (typeof value === 'undefined') return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${name} must be either "true" or "false".`)
}

function readInteger(env: NodeJS.ProcessEnv, rule: IntegerRule) {
  const value = env[rule.name]
  if (typeof value === 'undefined') return rule.fallback
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${rule.name} must be a positive base-10 integer.`)
  }

  const parsed = Number(value)
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < rule.minimum ||
    parsed > rule.maximum
  ) {
    throw new Error(
      `${rule.name} must be between ${rule.minimum} and ${rule.maximum}.`
    )
  }
  return parsed
}

function readStorage(
  env: NodeJS.ProcessEnv,
  localRuntime: boolean
): ImportExportPackageStorage {
  const value = env.IMPORT_EXPORT_PACKAGE_STORAGE
  const storage = value ?? (localRuntime ? 'local' : 'azure')
  if (storage !== 'azure' && storage !== 'local') {
    throw new Error(
      'IMPORT_EXPORT_PACKAGE_STORAGE must be either "azure" or "local".'
    )
  }
  if (!localRuntime && storage === 'local') {
    throw new Error(
      'IMPORT_EXPORT_PACKAGE_STORAGE must be "azure" outside development and test.'
    )
  }
  return storage
}

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value)
}

export function parseImportExportRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ImportExportRuntimeConfig {
  const localRuntime = env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
  const assessmentMode = readBoolean(env, 'ASSESSMENT_MODE', false)
  const requestedEnabled = readBoolean(env, 'IMPORT_EXPORT_ENABLED', false)
  const enabled = !assessmentMode && requestedEnabled
  const privatePreviewOnly = readBoolean(
    env,
    'IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY',
    !localRuntime
  )
  const packageStorage = readStorage(env, localRuntime)
  const packageTtlHours = readInteger(env, {
    name: 'IMPORT_EXPORT_PACKAGE_TTL_HOURS',
    fallback: 24,
    minimum: 1,
    maximum: MAX_PACKAGE_TTL_HOURS,
  })
  const rateLimitWindowSeconds = readInteger(env, {
    name: 'IMPORT_EXPORT_PACKAGE_RATE_LIMIT_WINDOW_SECONDS',
    fallback: 15 * 60,
    minimum: 1,
    maximum: 24 * 60 * 60,
  })
  const rateLimits = frozen({
    preview: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_PREVIEW_RATE_LIMIT',
      fallback: 30,
      minimum: 1,
      maximum: 10_000,
    }),
    export: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_EXPORT_RATE_LIMIT',
      fallback: 30,
      minimum: 1,
      maximum: 10_000,
    }),
    upload: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_UPLOAD_RATE_LIMIT',
      fallback: 30,
      minimum: 1,
      maximum: 10_000,
    }),
    validate: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_VALIDATE_RATE_LIMIT',
      fallback: 30,
      minimum: 1,
      maximum: 10_000,
    }),
    import: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_IMPORT_RATE_LIMIT',
      fallback: 5,
      minimum: 1,
      maximum: 10_000,
    }),
  })
  const concurrency = frozen({
    leaseTtlMs: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS',
      fallback: 2 * 60 * 1000,
      minimum: 3_000,
      maximum: 15 * 60 * 1000,
    }),
    previewPerUser: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_PREVIEW_CONCURRENCY',
      fallback: 2,
      minimum: 1,
      maximum: 1_000,
    }),
    previewGlobal: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY',
      fallback: 8,
      minimum: 1,
      maximum: 10_000,
    }),
    uploadPerUser: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY',
      fallback: 1,
      minimum: 1,
      maximum: 1_000,
    }),
    uploadGlobal: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY',
      fallback: 4,
      minimum: 1,
      maximum: 10_000,
    }),
    validatePerUser: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY',
      fallback: 2,
      minimum: 1,
      maximum: 1_000,
    }),
    validateGlobal: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY',
      fallback: 8,
      minimum: 1,
      maximum: 10_000,
    }),
    importPerUser: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY',
      fallback: 1,
      minimum: 1,
      maximum: 1_000,
    }),
    importGlobal: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY',
      fallback: 4,
      minimum: 1,
      maximum: 10_000,
    }),
    exportPerUser: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_EXPORT_CONCURRENCY',
      fallback: 2,
      minimum: 1,
      maximum: 1_000,
    }),
    exportGlobal: readInteger(env, {
      name: 'IMPORT_EXPORT_PACKAGE_EXPORT_GLOBAL_CONCURRENCY',
      fallback: 8,
      minimum: 1,
      maximum: 10_000,
    }),
  })
  const timeouts = frozen({
    uploadBodyMs: readInteger(env, {
      name: 'IMPORT_EXPORT_UPLOAD_BODY_TIMEOUT_MS',
      fallback: 60_000,
      minimum: 1_000,
      maximum: 120_000,
    }),
    azureMetadataMs: readInteger(env, {
      name: 'IMPORT_EXPORT_AZURE_METADATA_TIMEOUT_MS',
      fallback: 10_000,
      minimum: 1_000,
      maximum: 60_000,
    }),
    azureTransferMs: readInteger(env, {
      name: 'IMPORT_EXPORT_AZURE_TRANSFER_TIMEOUT_MS',
      fallback: 60_000,
      minimum: 1_000,
      maximum: 300_000,
    }),
  })

  if (concurrency.previewGlobal < concurrency.previewPerUser) {
    throw new Error(
      'IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY must be greater than or equal to IMPORT_EXPORT_PACKAGE_PREVIEW_CONCURRENCY.'
    )
  }
  if (concurrency.exportGlobal < concurrency.exportPerUser) {
    throw new Error(
      'IMPORT_EXPORT_PACKAGE_EXPORT_GLOBAL_CONCURRENCY must be greater than or equal to IMPORT_EXPORT_PACKAGE_EXPORT_CONCURRENCY.'
    )
  }
  if (concurrency.uploadGlobal < concurrency.uploadPerUser) {
    throw new Error(
      'IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY must be greater than or equal to IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY.'
    )
  }
  if (concurrency.validateGlobal < concurrency.validatePerUser) {
    throw new Error(
      'IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY must be greater than or equal to IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY.'
    )
  }
  if (concurrency.importGlobal < concurrency.importPerUser) {
    throw new Error(
      'IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY must be greater than or equal to IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY.'
    )
  }
  return frozen({
    assessmentMode,
    enabled,
    privatePreviewOnly,
    packageStorage,
    packageTtlHours,
    rateLimitWindowSeconds,
    rateLimits,
    concurrency,
    timeouts,
    limits: frozen({
      packageBytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
      elements: MAX_IMPORT_EXPORT_ELEMENTS,
      answerCollections: MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS,
      answerCollectionEntries: MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES,
      totalAnswerCollectionEntries:
        MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES,
      selectedAnswerCollectionItems:
        MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS,
      mediaFiles: MAX_IMPORT_EXPORT_MEDIA_FILES,
      mediaBytes: MAX_IMPORT_EXPORT_MEDIA_BYTES,
      unexpiredArtifacts: MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS,
      unexpiredArtifactBytes: MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACT_BYTES,
    }),
  })
}

let initializedConfig: ImportExportRuntimeConfig | undefined

export function initializeImportExportRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
) {
  initializedConfig = parseImportExportRuntimeConfig(env)
  return initializedConfig
}

export function getImportExportRuntimeConfig() {
  return initializedConfig ?? parseImportExportRuntimeConfig()
}

export function getImportExportStartupResponsibilities(
  role: ImportExportProcessRole,
  config: ImportExportRuntimeConfig = getImportExportRuntimeConfig()
): ImportExportStartupResponsibilities {
  const userOperations = role === 'backend' && config.enabled
  const maintenance =
    role === 'general-worker' && config.assessmentMode === false

  return frozen({
    userOperations,
    maintenance,
    requiresPackageStorage: userOperations || maintenance,
    requiresTokenSecret: userOperations,
  })
}
