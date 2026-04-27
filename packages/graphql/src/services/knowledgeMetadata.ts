import {
  KBGraphInclusionMode,
  KBMetadataProfile,
  KBRefreshMode,
  KBRefreshScope,
  KBResourceKind,
  KBWebsiteStrategy,
} from '@klicker-uzh/prisma/client'
import { z } from 'zod'

const studyLevelSchema = z.enum(['BACHELOR', 'MASTER', 'BOTH', 'PHD', 'OTHER'])

const scopeSchema = z.enum([
  'UZH_WIDE',
  'FACULTY',
  'DEPARTMENT',
  'COURSE',
  'CUSTOM',
])

const audienceSchema = z.enum([
  'LECTURERS',
  'STUDENTS',
  'TUTORS',
  'ADMINISTRATORS',
  'PUBLIC',
])

const jsonScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])
type JsonValue = z.infer<typeof jsonScalarSchema> | JsonValue[] | JsonObject
type JsonObject = { [key: string]: JsonValue }

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    jsonScalarSchema,
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
)

const metadataSchema = z
  .object({
    studyLevel: studyLevelSchema.nullish(),
    scope: scopeSchema.nullish(),
    faculty: z.string().min(1).nullish(),
    department: z.string().min(1).nullish(),
    courseId: z.string().min(1).nullish(),
    courseIds: z.array(z.string().min(1)).optional(),
    language: z.string().min(1).nullish(),
    audience: z.array(audienceSchema).optional(),
    tags: z.array(z.string().min(1)).optional(),
    visibility: z.array(z.string().min(1)).optional(),
    retrievalTags: z.array(z.string().min(1)).optional(),
    custom: z.record(jsonValueSchema).optional(),
  })
  .strict()

const resourceMetadataSchema = z
  .object({
    studyLevel: studyLevelSchema.nullish(),
    scope: scopeSchema.nullish(),
    faculty: z.string().min(1).nullish(),
    department: z.string().min(1).nullish(),
    courseId: z.string().min(1).nullish(),
    language: z.string().min(1).nullish(),
    audience: z.array(audienceSchema).optional(),
    visibleToStudents: z.boolean().optional(),
    retrievalTags: z.array(z.string().min(1)).optional(),
    accessLevel: z.string().min(1).nullish(),
    sourceOwner: z.string().min(1).nullish(),
    custom: z.record(jsonValueSchema).optional(),
  })
  .strict()

const retrievalSettingsSchema = z
  .object({
    chunksPerQuery: z.number().int().positive().nullish(),
    similarityThreshold: z.number().min(0).max(1).nullish(),
    contextWindowTokens: z.number().int().positive().nullish(),
    strategy: z.enum(['HYBRID', 'VECTOR', 'BM25']).nullish(),
    citationMode: z.enum(['REQUIRED', 'OPTIONAL', 'DISABLED']).nullish(),
    offScopeFallback: z
      .enum(['REFUSE', 'REFUSE_AND_SUGGEST', 'ALLOW'])
      .nullish(),
  })
  .strict()

const settingsSchema = z
  .object({
    generationModelId: z.string().min(1).nullish(),
    embeddingModelId: z.string().min(1).nullish(),
    rerankingModelId: z.string().min(1).nullish(),
    retrieval: retrievalSettingsSchema.optional(),
    budget: z
      .object({
        monthlyLimitCents: z.number().int().nonnegative().nullish(),
        alertThresholdPercent: z.number().min(0).max(100).nullish(),
      })
      .strict()
      .optional(),
    external: z
      .object({
        ingestionPipelineId: z.string().min(1).nullish(),
        vectorNamespace: z.string().min(1).nullish(),
        graphNamespace: z.string().min(1).nullish(),
        parserProfile: z.string().min(1).nullish(),
      })
      .strict()
      .optional(),
  })
  .strict()

type MetadataProfile = keyof typeof KBMetadataProfile | `${KBMetadataProfile}`

function parseProfile(profile: MetadataProfile): KBMetadataProfile {
  if (
    !Object.values(KBMetadataProfile).includes(profile as KBMetadataProfile)
  ) {
    throw new Error(`Unknown KB metadata profile: ${profile}`)
  }
  return profile as KBMetadataProfile
}

function profileSchema(profile: MetadataProfile) {
  parseProfile(profile)
  return metadataSchema
}

function resourceProfileSchema(profile: MetadataProfile) {
  parseProfile(profile)
  return resourceMetadataSchema
}

export function validateKBMetadata(
  profile: MetadataProfile,
  metadata: unknown
) {
  if (metadata == null) return null

  const parsed = profileSchema(profile).safeParse(metadata)
  if (!parsed.success) {
    throw new Error(
      `Invalid KB metadata: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(', ')}`
    )
  }

  return parsed.data
}

export function validateKBResourceMetadata(
  profile: MetadataProfile,
  metadata: unknown
) {
  if (metadata == null) return null

  const parsed = resourceProfileSchema(profile).safeParse(metadata)
  if (!parsed.success) {
    throw new Error(
      `Invalid KB resource metadata: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(', ')}`
    )
  }

  return parsed.data
}

export function validateKBSettings(settings: unknown) {
  if (settings == null) return null

  const parsed = settingsSchema.safeParse(settings)
  if (!parsed.success) {
    throw new Error(
      `Invalid KB settings: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(', ')}`
    )
  }

  return parsed.data
}

export interface KBRefreshPolicyInput {
  refreshMode: keyof typeof KBRefreshMode | `${KBRefreshMode}`
  refreshScope?: keyof typeof KBRefreshScope | `${KBRefreshScope}` | null
  refreshIntervalMinutes?: number | null
  refreshCron?: string | null
  changeMonitoring?: boolean | null
}

export function validateKBRefreshPolicy(input: KBRefreshPolicyInput) {
  const refreshMode = input.refreshMode as KBRefreshMode
  if (!Object.values(KBRefreshMode).includes(refreshMode)) {
    throw new Error('Invalid refreshMode')
  }

  const refreshScope = (input.refreshScope ??
    KBRefreshScope.REFRESHABLE) as KBRefreshScope
  if (!Object.values(KBRefreshScope).includes(refreshScope)) {
    throw new Error('Invalid refreshScope')
  }

  if (
    refreshMode === KBRefreshMode.INTERVAL &&
    (!input.refreshIntervalMinutes || input.refreshIntervalMinutes <= 0)
  ) {
    throw new Error('refreshIntervalMinutes must be greater than 0')
  }

  if (refreshMode === KBRefreshMode.CRON && !input.refreshCron?.trim()) {
    throw new Error('refreshCron is required for CRON refresh mode')
  }

  return {
    refreshMode,
    refreshScope,
    refreshIntervalMinutes:
      refreshMode === KBRefreshMode.INTERVAL
        ? input.refreshIntervalMinutes
        : null,
    refreshCron:
      refreshMode === KBRefreshMode.CRON ? input.refreshCron?.trim() : null,
    changeMonitoring: input.changeMonitoring ?? false,
  }
}

export interface KBResourceRefreshPolicyInput {
  refreshMode: keyof typeof KBRefreshMode | `${KBRefreshMode}`
  refreshScope?: keyof typeof KBRefreshScope | `${KBRefreshScope}` | null
  refreshIntervalMinutes?: number | null
  refreshCron?: string | null
  changeMonitoring?: boolean | null
}

export function validateKBResourceRefreshPolicy(
  input: KBResourceRefreshPolicyInput
) {
  if (input.refreshMode === KBRefreshMode.INHERIT) {
    return {
      refreshMode: KBRefreshMode.INHERIT,
      refreshScope: null,
      refreshIntervalMinutes: null,
      refreshCron: null,
      changeMonitoring: input.changeMonitoring ?? null,
    }
  }

  return validateKBRefreshPolicy(input)
}

export interface KBResourceSourceInput {
  kind: keyof typeof KBResourceKind | `${KBResourceKind}`
  externalResourceId?: string | null
  mediaFileId?: string | null
  documentFileName?: string | null
  documentMimeType?: string | null
  documentPageCount?: number | null
  documentLanguage?: string | null
  websiteUrl?: string | null
  websiteStrategy?:
    | keyof typeof KBWebsiteStrategy
    | `${KBWebsiteStrategy}`
    | null
  crawlDepth?: number | null
  snippetText?: string | null
  snippetLanguage?: string | null
  snippetAuthor?: string | null
  snippetNote?: string | null
  elementId?: number | null
  practiceQuizId?: string | null
  liveQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
  answerCollectionId?: number | null
}

const KLICKER_OBJECT_REFERENCE_KEYS = [
  'elementId',
  'practiceQuizId',
  'liveQuizId',
  'microLearningId',
  'groupActivityId',
  'answerCollectionId',
  'mediaFileId',
] as const

export function validateKBResourceSource(input: KBResourceSourceInput) {
  const kind = input.kind as KBResourceKind
  if (!Object.values(KBResourceKind).includes(kind)) {
    throw new Error('Invalid resource source for kind')
  }

  if (kind === KBResourceKind.DOCUMENT) {
    if (!input.mediaFileId && !input.externalResourceId) {
      throw new Error(
        'Invalid resource source for kind: document requires mediaFileId or externalResourceId'
      )
    }

    return {
      kind,
      externalResourceId: input.externalResourceId ?? null,
      mediaFileId: input.mediaFileId ?? null,
      documentFileName: input.documentFileName?.trim() || null,
      documentMimeType: input.documentMimeType?.trim() || null,
      documentPageCount: input.documentPageCount ?? null,
      documentLanguage: input.documentLanguage?.trim() || null,
    }
  }

  if (kind === KBResourceKind.WEBSITE) {
    if (!input.websiteUrl?.trim()) {
      throw new Error(
        'Invalid resource source for kind: websiteUrl is required'
      )
    }

    try {
      new URL(input.websiteUrl)
    } catch {
      throw new Error('Invalid resource source for kind: websiteUrl is invalid')
    }

    const websiteStrategy = input.websiteStrategy as KBWebsiteStrategy
    if (!Object.values(KBWebsiteStrategy).includes(websiteStrategy)) {
      throw new Error(
        'Invalid resource source for kind: websiteStrategy is required'
      )
    }

    return {
      kind,
      websiteUrl: input.websiteUrl.trim(),
      websiteStrategy,
      crawlDepth: input.crawlDepth ?? null,
    }
  }

  if (kind === KBResourceKind.SNIPPET) {
    const snippetText = input.snippetText?.trim()
    if (!snippetText) {
      throw new Error(
        'Invalid resource source for kind: snippetText is required'
      )
    }

    return {
      kind,
      snippetText,
      snippetCharacterCount: snippetText.length,
      snippetLanguage: input.snippetLanguage?.trim() || null,
      snippetAuthor: input.snippetAuthor?.trim() || null,
      snippetNote: input.snippetNote?.trim() || null,
    }
  }

  const presentReferences = KLICKER_OBJECT_REFERENCE_KEYS.filter(
    (key) => input[key] != null
  )

  if (presentReferences.length !== 1) {
    throw new Error('Exactly one Klicker object reference is required')
  }

  return {
    kind,
    mediaFileId: input.mediaFileId ?? null,
    elementId: input.elementId ?? null,
    practiceQuizId: input.practiceQuizId ?? null,
    liveQuizId: input.liveQuizId ?? null,
    microLearningId: input.microLearningId ?? null,
    groupActivityId: input.groupActivityId ?? null,
    answerCollectionId: input.answerCollectionId ?? null,
  }
}

export interface KBGraphPolicy {
  graphEnabled: boolean
  graphResourceKinds: KBResourceKind[]
}

export interface KBGraphResourcePolicy {
  kind: KBResourceKind
  graphInclusion: KBGraphInclusionMode
}

export function isResourceIncludedInGraph(
  kb: KBGraphPolicy,
  resource: KBGraphResourcePolicy
) {
  return (
    resource.graphInclusion === KBGraphInclusionMode.INCLUDE ||
    (resource.graphInclusion === KBGraphInclusionMode.INHERIT &&
      kb.graphEnabled &&
      kb.graphResourceKinds.includes(resource.kind))
  )
}
