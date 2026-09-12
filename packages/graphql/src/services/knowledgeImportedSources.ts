import { createHash } from 'node:crypto'
// Type-only: validation and fingerprinting must not load the Prisma runtime.
import type * as DB from '@klicker-uzh/prisma/client'
import { z } from 'zod'

export const IMPORTED_KB_SOURCES_MANIFEST_VERSION = 1 as const
export const IMPORTED_KB_SOURCES_MAX_ENTRIES = 5000 as const

const MAX_IDENTIFIER_LENGTH = 256
const MAX_COLLECTION_NAME_LENGTH = 256
const MAX_TITLE_LENGTH = 512
const MAX_IDENTITY_VALUE_LENGTH = 512
const MAX_SOURCE_URL_LENGTH = 2048

const SOURCE_IDENTITY_FIELDS = ['source_id', 'video_source_id'] as const
const SOURCE_KINDS = ['DOCUMENT', 'LINK', 'VIDEO', 'IMAGE'] as const

// Inlined enum values keep the offline path free of the Prisma runtime while
// the annotation still checks them against the generated enum.
const IDENTITY_FIELD_TO_DB: Record<
  (typeof SOURCE_IDENTITY_FIELDS)[number],
  DB.KBImportedSourceIdentityField
> = {
  source_id: 'SOURCE_ID',
  video_source_id: 'VIDEO_SOURCE_ID',
}

export type ImportedKbSourceIdentityField =
  (typeof SOURCE_IDENTITY_FIELDS)[number]
export type ImportedKbSourceKind = (typeof SOURCE_KINDS)[number]

// Normalized manifest entry: trimmed strings, ISO-8601 UTC timestamps, absolute
// safe http(s) URL without credentials, query or fragment, or null for unknown.
export type ImportedKbSourceManifestEntry = {
  sourceIdentityField: ImportedKbSourceIdentityField
  sourceIdentityValue: string
  projectId: string | null
  producerId: string | null
  title: string
  kind: ImportedKbSourceKind
  sourceUrl: string | null
  ingestedAt: string | null
  observedAt: string
}

export type ImportedKbSourcesManifest = {
  version: typeof IMPORTED_KB_SOURCES_MANIFEST_VERSION
  kbId: string
  expectedOwnerId: string
  databaseName: string
  collectionName: string
  sources: ImportedKbSourceManifestEntry[]
}

export type ImportedKbSourcesErrorCode =
  | 'MANIFEST_UNREADABLE'
  | 'MANIFEST_INVALID'
  | 'MANIFEST_VERSION_UNSUPPORTED'
  | 'DUPLICATE_SOURCE_IDENTITY'
  | 'SOURCE_URL_UNSAFE'
  | 'FINGERPRINT_MISMATCH'
  | 'KB_NOT_FOUND'
  | 'KB_DELETED'
  | 'SOURCE_METADATA_CONFLICT'
  | 'REGISTRATION_FAILED'

class ImportedKbSourcesError extends Error {
  readonly code: ImportedKbSourcesErrorCode

  constructor(code: ImportedKbSourcesErrorCode) {
    // The code doubles as the message; manifest values and driver errors are
    // never attached so nothing sensitive can leak through an error string.
    super(code)
    this.name = 'ImportedKbSourcesError'
    this.code = code
  }
}

const boundedIdentifier = (max: number) => z.string().trim().min(1).max(max)

const manifestSourceSchema = z
  .object({
    sourceIdentityField: z.enum(SOURCE_IDENTITY_FIELDS),
    sourceIdentityValue: boundedIdentifier(MAX_IDENTITY_VALUE_LENGTH),
    projectId: boundedIdentifier(MAX_IDENTIFIER_LENGTH).nullish(),
    producerId: boundedIdentifier(MAX_IDENTIFIER_LENGTH).nullish(),
    title: boundedIdentifier(MAX_TITLE_LENGTH),
    kind: z.enum(SOURCE_KINDS),
    sourceUrl: boundedIdentifier(MAX_SOURCE_URL_LENGTH).nullish(),
    ingestedAt: z.string().trim().datetime({ offset: true }).nullish(),
    observedAt: z.string().trim().datetime({ offset: true }),
  })
  .strict()

const manifestSchema = z
  .object({
    version: z.literal(IMPORTED_KB_SOURCES_MANIFEST_VERSION),
    kbId: z.string().uuid(),
    expectedOwnerId: z.string().uuid(),
    databaseName: boundedIdentifier(MAX_IDENTIFIER_LENGTH),
    collectionName: boundedIdentifier(MAX_COLLECTION_NAME_LENGTH),
    sources: z
      .array(manifestSourceSchema)
      .min(1)
      .max(IMPORTED_KB_SOURCES_MAX_ENTRIES),
  })
  .strict()

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

// http(s) only; credentials, query and fragment are rejected so signed or
// short-lived links cannot be persisted as a stable original URL.
function normalizeSafeSourceUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ImportedKbSourcesError('SOURCE_URL_UNSAFE')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImportedKbSourcesError('SOURCE_URL_UNSAFE')
  }
  if (url.username !== '' || url.password !== '') {
    throw new ImportedKbSourcesError('SOURCE_URL_UNSAFE')
  }
  if (url.search !== '' || url.hash !== '') {
    throw new ImportedKbSourcesError('SOURCE_URL_UNSAFE')
  }
  return url.toString()
}

function normalizeIsoDate(value: string | null): string | null {
  return value === null ? null : new Date(value).toISOString()
}

function normalizeSourceEntry(
  input: z.infer<typeof manifestSourceSchema>
): ImportedKbSourceManifestEntry {
  return {
    sourceIdentityField: input.sourceIdentityField,
    sourceIdentityValue: input.sourceIdentityValue,
    projectId: input.projectId ?? null,
    producerId: input.producerId ?? null,
    title: input.title,
    kind: input.kind,
    sourceUrl:
      input.sourceUrl == null ? null : normalizeSafeSourceUrl(input.sourceUrl),
    ingestedAt: normalizeIsoDate(input.ingestedAt ?? null),
    observedAt: normalizeIsoDate(input.observedAt) as string,
  }
}

function identitySortKey(
  field: ImportedKbSourceIdentityField,
  value: string
): string {
  return `${field}\u0000${value}`
}

function canonicalIdentityJson(
  databaseName: string,
  collectionName: string,
  field: ImportedKbSourceIdentityField,
  value: string
): string {
  return JSON.stringify([databaseName, collectionName, field, value])
}

function canonicalMetadataJson(
  manifest: ImportedKbSourcesManifest,
  entry: ImportedKbSourceManifestEntry
): string {
  return JSON.stringify([
    manifest.databaseName,
    manifest.collectionName,
    entry.sourceIdentityField,
    entry.sourceIdentityValue,
    entry.projectId,
    entry.producerId,
    entry.title,
    entry.kind,
    entry.sourceUrl,
    entry.ingestedAt,
    entry.observedAt,
  ])
}

// Fingerprint over the fixed manifest coordinates and every source in a
// canonical order, so entry order and equivalent date spellings do not change
// its meaning.
function computeManifestFingerprint(manifest: ImportedKbSourcesManifest) {
  return sha256(
    JSON.stringify([
      manifest.version,
      manifest.kbId,
      manifest.expectedOwnerId,
      manifest.databaseName,
      manifest.collectionName,
      manifest.sources.map((entry) => [
        entry.sourceIdentityField,
        entry.sourceIdentityValue,
        entry.projectId,
        entry.producerId,
        entry.title,
        entry.kind,
        entry.sourceUrl,
        entry.ingestedAt,
        entry.observedAt,
      ]),
    ])
  )
}

export type ImportedKbSourcesManifestValidation =
  | {
      ok: true
      manifest: ImportedKbSourcesManifest
      fingerprint: string
    }
  | { ok: false; errorCode: ImportedKbSourcesErrorCode }

export function validateImportedKbSourcesManifest(
  input: unknown
): ImportedKbSourcesManifestValidation {
  const rawVersion =
    typeof input === 'object' && input !== null && 'version' in input
      ? (input as { version: unknown }).version
      : undefined
  if (
    rawVersion !== undefined &&
    rawVersion !== IMPORTED_KB_SOURCES_MANIFEST_VERSION
  ) {
    return { ok: false, errorCode: 'MANIFEST_VERSION_UNSUPPORTED' }
  }

  const parsed = manifestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errorCode: 'MANIFEST_INVALID' }
  }

  let sources: ImportedKbSourceManifestEntry[]
  try {
    sources = parsed.data.sources.map((entry) => normalizeSourceEntry(entry))
  } catch (error) {
    if (error instanceof ImportedKbSourcesError) {
      return { ok: false, errorCode: error.code }
    }
    return { ok: false, errorCode: 'MANIFEST_INVALID' }
  }

  const seen = new Set<string>()
  for (const entry of sources) {
    const key = identitySortKey(
      entry.sourceIdentityField,
      entry.sourceIdentityValue
    )
    if (seen.has(key)) {
      return { ok: false, errorCode: 'DUPLICATE_SOURCE_IDENTITY' }
    }
    seen.add(key)
  }

  sources.sort((left, right) =>
    identitySortKey(left.sourceIdentityField, left.sourceIdentityValue) <
    identitySortKey(right.sourceIdentityField, right.sourceIdentityValue)
      ? -1
      : 1
  )

  const manifest: ImportedKbSourcesManifest = {
    version: IMPORTED_KB_SOURCES_MANIFEST_VERSION,
    kbId: parsed.data.kbId,
    expectedOwnerId: parsed.data.expectedOwnerId,
    databaseName: parsed.data.databaseName,
    collectionName: parsed.data.collectionName,
    sources,
  }

  return {
    ok: true,
    manifest,
    fingerprint: computeManifestFingerprint(manifest),
  }
}

export type ImportedKbSourcesRegistrationResult =
  | {
      ok: true
      status: 'applied' | 'noop'
      fingerprint: string
      insertedCount: number
      existingCount: number
    }
  | { ok: false; errorCode: ImportedKbSourcesErrorCode }

function isPrismaError(error: unknown, code: 'P2002'): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  )
}

type StoredImportedSource = {
  identitySha256: string
  metadataSha256: string
  databaseName: string
  collectionName: string
  sourceIdentityField: DB.KBImportedSourceIdentityField
  sourceIdentityValue: string
  projectId: string | null
  producerId: string | null
  title: string
  kind: DB.KBImportedSourceKind
  sourceUrl: string | null
  ingestedAt: Date | null
  observedAt: Date
}

function isSameStoredSource(
  stored: StoredImportedSource,
  manifest: ImportedKbSourcesManifest,
  entry: ImportedKbSourceManifestEntry,
  metadataSha256: string
): boolean {
  return (
    stored.databaseName === manifest.databaseName &&
    stored.collectionName === manifest.collectionName &&
    stored.sourceIdentityField ===
      IDENTITY_FIELD_TO_DB[entry.sourceIdentityField] &&
    stored.sourceIdentityValue === entry.sourceIdentityValue &&
    stored.projectId === entry.projectId &&
    stored.producerId === entry.producerId &&
    stored.title === entry.title &&
    stored.kind === entry.kind &&
    stored.sourceUrl === entry.sourceUrl &&
    normalizeIsoDate(stored.ingestedAt?.toISOString() ?? null) ===
      entry.ingestedAt &&
    stored.observedAt.toISOString() === entry.observedAt &&
    stored.metadataSha256 === metadataSha256
  )
}

function buildInsertData(
  manifest: ImportedKbSourcesManifest,
  entry: ImportedKbSourceManifestEntry,
  identitySha256: string,
  metadataSha256: string
): DB.Prisma.KBImportedSourceCreateManyInput {
  return {
    kbId: manifest.kbId,
    databaseName: manifest.databaseName,
    collectionName: manifest.collectionName,
    sourceIdentityField: IDENTITY_FIELD_TO_DB[entry.sourceIdentityField],
    sourceIdentityValue: entry.sourceIdentityValue,
    projectId: entry.projectId,
    producerId: entry.producerId,
    title: entry.title,
    kind: entry.kind,
    sourceUrl: entry.sourceUrl,
    ingestedAt: entry.ingestedAt === null ? null : new Date(entry.ingestedAt),
    observedAt: new Date(entry.observedAt),
    identitySha256,
    metadataSha256,
  }
}

export async function registerImportedKbSources({
  prisma,
  input,
  reviewedFingerprint,
}: {
  prisma: DB.PrismaClient
  input: unknown
  reviewedFingerprint: string
}): Promise<ImportedKbSourcesRegistrationResult> {
  const validation = validateImportedKbSourcesManifest(input)
  if (!validation.ok) {
    return { ok: false, errorCode: validation.errorCode }
  }
  const { manifest, fingerprint } = validation
  if (fingerprint !== reviewedFingerprint) {
    return { ok: false, errorCode: 'FINGERPRINT_MISMATCH' }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Holding the KB row serializes competing registrations and KB deletion
      // for the same knowledge base until this transaction completes.
      const locked = await tx.$queryRaw<
        Array<{ ownerId: string; deletedAt: Date | null }>
      >`
        SELECT "ownerId", "deletedAt"
        FROM "public"."KB"
        WHERE "id" = CAST(${manifest.kbId} AS UUID)
        FOR UPDATE
      `
      if (locked.length === 0) {
        throw new ImportedKbSourcesError('KB_NOT_FOUND')
      }
      const kb = locked[0]!
      if (kb.ownerId !== manifest.expectedOwnerId) {
        throw new ImportedKbSourcesError('KB_NOT_FOUND')
      }
      if (kb.deletedAt !== null) {
        throw new ImportedKbSourcesError('KB_DELETED')
      }

      const existingRows = await tx.kBImportedSource.findMany({
        where: { kbId: manifest.kbId },
        select: {
          identitySha256: true,
          metadataSha256: true,
          databaseName: true,
          collectionName: true,
          sourceIdentityField: true,
          sourceIdentityValue: true,
          projectId: true,
          producerId: true,
          title: true,
          kind: true,
          sourceUrl: true,
          ingestedAt: true,
          observedAt: true,
        },
      })
      const existingByIdentity = new Map<string, StoredImportedSource>()
      for (const row of existingRows) {
        existingByIdentity.set(row.identitySha256, row)
      }

      const pending = new Set<string>()
      const inserts: DB.Prisma.KBImportedSourceCreateManyInput[] = []
      let existingCount = 0

      for (const entry of manifest.sources) {
        const identitySha256 = sha256(
          canonicalIdentityJson(
            manifest.databaseName,
            manifest.collectionName,
            entry.sourceIdentityField,
            entry.sourceIdentityValue
          )
        )
        const metadataSha256 = sha256(canonicalMetadataJson(manifest, entry))

        const stored = existingByIdentity.get(identitySha256)
        if (stored) {
          if (!isSameStoredSource(stored, manifest, entry, metadataSha256)) {
            throw new ImportedKbSourcesError('SOURCE_METADATA_CONFLICT')
          }
          existingCount += 1
          continue
        }

        if (pending.has(identitySha256)) {
          throw new ImportedKbSourcesError('DUPLICATE_SOURCE_IDENTITY')
        }
        pending.add(identitySha256)
        inserts.push(
          buildInsertData(manifest, entry, identitySha256, metadataSha256)
        )
      }

      // All comparison happens before the first insert so a conflict rolls the
      // whole manifest back without partial rows.
      if (inserts.length > 0) {
        await tx.kBImportedSource.createMany({ data: inserts })
      }

      return {
        ok: true as const,
        status: inserts.length > 0 ? ('applied' as const) : ('noop' as const),
        fingerprint,
        insertedCount: inserts.length,
        existingCount,
      }
    })
  } catch (error) {
    if (error instanceof ImportedKbSourcesError) {
      return { ok: false, errorCode: error.code }
    }
    if (isPrismaError(error, 'P2002')) {
      return { ok: false, errorCode: 'SOURCE_METADATA_CONFLICT' }
    }
    return { ok: false, errorCode: 'REGISTRATION_FAILED' }
  }
}
