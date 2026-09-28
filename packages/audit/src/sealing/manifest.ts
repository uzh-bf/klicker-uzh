import type { ContainerClient } from '@azure/storage-blob'
import { z } from 'zod'
import { matchesBlobMetadata } from '../azure/blob-metadata.js'
import { canonicalizeJson } from '../canonical/canonicalize.js'
import { sha256Hex } from '../canonical/hash.js'

const FORMAT = 'KLICKER_ASSESSMENT_AUDIT_MANIFEST' as const
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256 = /^[0-9a-f]{64}$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const isoDate = z
  .string()
  .refine(
    (value) =>
      ISO.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString() === value,
    'ISO UTC timestamp required'
  )
const manifestSchema = z
  .object({
    format: z.literal(FORMAT),
    formatVersion: z.literal(1),
    liveQuizId: z.string().regex(UUID),
    lifecycleEpoch: z.number().int().nonnegative(),
    sequence: z.number().int().positive().max(999_999_999_999),
    previousManifestHash: z.string().regex(SHA256).nullable(),
    createdAt: isoDate,
    retainUntil: isoDate,
    events: z
      .array(
        z
          .object({
            eventId: z.string().regex(UUID),
            eventHash: z.string().regex(SHA256),
            canonicalHash: z.string().regex(SHA256),
          })
          .strict()
      )
      .min(1),
  })
  .strict()

export type AuditManifest = {
  format: typeof FORMAT
  formatVersion: 1
  liveQuizId: string
  lifecycleEpoch: number
  sequence: number
  previousManifestHash: string | null
  createdAt: string
  retainUntil: string
  events: Array<{ eventId: string; eventHash: string; canonicalHash: string }>
}

export type StoredAuditManifest = {
  manifest: AuditManifest
  manifestHash: string
  blobName: string
  versionId: string
}

export interface AuditManifestStore {
  list(
    liveQuizId: string,
    options?: { repairPending?: boolean; minimumRetainUntil?: Date }
  ): Promise<StoredAuditManifest[]>
  create(manifest: AuditManifest): Promise<StoredAuditManifest>
}

type BlobProperties = {
  metadata?: Record<string, string>
  contentType?: string
  versionId?: string
  immutabilityPolicyExpiresOn?: Date
  immutabilityPolicyMode?: string
}

export function validateAuditManifest(value: unknown): AuditManifest {
  const manifest = manifestSchema.parse(value) as AuditManifest
  if (
    new Date(manifest.retainUntil).getTime() <=
    new Date(manifest.createdAt).getTime()
  ) {
    throw new TypeError('Manifest retainUntil must be after createdAt')
  }
  for (let index = 1; index < manifest.events.length; index += 1) {
    if (
      manifest.events[index - 1]!.eventId >= manifest.events[index]!.eventId
    ) {
      throw new TypeError(
        'Manifest events must be sorted and unique by eventId'
      )
    }
  }
  return manifest
}

function nameFor(
  manifest: Pick<AuditManifest, 'liveQuizId' | 'lifecycleEpoch' | 'sequence'>
): string {
  return `manifest/v1/${manifest.liveQuizId}/${manifest.lifecycleEpoch}/${String(manifest.sequence).padStart(12, '0')}.json`
}

function conflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    ((error as { statusCode?: number }).statusCode === 409 ||
      (error as { statusCode?: number }).statusCode === 412)
  )
}

function requiredVersion(properties: BlobProperties, blobName: string): string {
  if (!properties.versionId)
    throw new Error(`Manifest ${blobName} has no version identity`)
  return properties.versionId
}

function lockedUntil(
  properties: BlobProperties,
  minimum: Date,
  now: Date,
  blobName: string
): void {
  if (
    properties.immutabilityPolicyMode?.toLowerCase() !== 'locked' ||
    !properties.immutabilityPolicyExpiresOn
  ) {
    throw new Error(`Manifest ${blobName} is not locked`)
  }
  if (
    properties.immutabilityPolicyExpiresOn.getTime() < minimum.getTime() ||
    properties.immutabilityPolicyExpiresOn.getTime() <= now.getTime()
  ) {
    throw new Error(`Manifest ${blobName} has insufficient retention`)
  }
}

function parseCanonical(
  bytes: Uint8Array,
  blobName: string
): { manifest: AuditManifest; manifestHash: string } {
  let text: string
  let value: unknown
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    value = JSON.parse(text)
  } catch {
    throw new Error(`Manifest ${blobName} is not valid JSON`)
  }
  const manifest = validateAuditManifest(value)
  if (canonicalizeJson(manifest) !== text)
    throw new Error(`Manifest ${blobName} is not canonical JSON`)
  return { manifest, manifestHash: sha256Hex(bytes) }
}

export class AzureAuditManifestStore implements AuditManifestStore {
  constructor(
    private readonly container: ContainerClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(input: AuditManifest): Promise<StoredAuditManifest> {
    const manifest = validateAuditManifest(input)
    const retainUntil = new Date(manifest.retainUntil)
    if (retainUntil.getTime() <= this.now().getTime())
      throw new TypeError('Manifest retainUntil must be in the future')
    const blobName = nameFor(manifest)
    const bytes = Buffer.from(canonicalizeJson(manifest))
    const hash = sha256Hex(bytes)
    const blob = this.container.getBlockBlobClient(blobName)
    try {
      const uploaded = await blob.uploadData(bytes, {
        conditions: { ifNoneMatch: '*' },
        metadata: { sha256: hash, bytelength: String(bytes.byteLength) },
        blobHTTPHeaders: { blobContentType: 'application/json' },
      })
      if (!uploaded.versionId)
        throw new Error(`Manifest ${blobName} has no version identity`)
      await blob.withVersion(uploaded.versionId).setImmutabilityPolicy({
        expiriesOn: retainUntil,
        policyMode: 'Locked',
      })
      return this.read(blobName, {
        expectedVersionId: uploaded.versionId,
        expected: manifest,
      })
    } catch (error) {
      if (!conflict(error)) throw error
      return this.read(blobName, {
        repairPending: true,
        expected: {
          liveQuizId: manifest.liveQuizId,
          lifecycleEpoch: manifest.lifecycleEpoch,
          sequence: manifest.sequence,
        },
      })
    }
  }

  async list(
    liveQuizId: string,
    options: { repairPending?: boolean; minimumRetainUntil?: Date } = {}
  ): Promise<StoredAuditManifest[]> {
    if (!UUID.test(liveQuizId)) throw new TypeError('liveQuizId must be a UUID')
    if (
      options.minimumRetainUntil &&
      Number.isNaN(options.minimumRetainUntil.getTime())
    )
      throw new TypeError('minimumRetainUntil must be a valid date')
    const prefix = `manifest/v1/${liveQuizId}/`
    const manifests: StoredAuditManifest[] = []
    const bySequence = new Map<string, StoredAuditManifest>()
    for await (const item of this.container.listBlobsFlat({
      prefix,
      includeVersions: true,
    })) {
      const parsed = /^manifest\/v1\/([^/]+)\/(\d+)\/(\d{12})\.json$/.exec(
        item.name
      )
      if (!parsed || parsed[1] !== liveQuizId)
        throw new Error(`Invalid manifest blob name ${item.name}`)
      const listedVersionId = item.versionId
      if (!listedVersionId)
        throw new Error(
          `Manifest ${item.name} was listed without a version identity`
        )
      const stored = await this.read(item.name, {
        repairPending: options.repairPending,
        minimumRetainUntil: options.minimumRetainUntil,
        expectedVersionId: listedVersionId,
        expected: {
          liveQuizId,
          lifecycleEpoch: Number(parsed[2]!),
          sequence: Number(parsed[3]!),
        },
      })
      const key = `${stored.manifest.lifecycleEpoch}/${stored.manifest.sequence}`
      const prior = bySequence.get(key)
      if (prior && prior.manifestHash !== stored.manifestHash)
        throw new Error(`Conflicting manifest versions for ${key}`)
      if (!prior) bySequence.set(key, stored)
    }
    manifests.push(...bySequence.values())
    manifests.sort(
      (a, b) =>
        a.manifest.lifecycleEpoch - b.manifest.lifecycleEpoch ||
        a.manifest.sequence - b.manifest.sequence
    )
    let priorEpoch = -1
    let prior: StoredAuditManifest | undefined
    for (const stored of manifests) {
      const current = stored.manifest
      if (current.lifecycleEpoch !== priorEpoch) {
        if (current.sequence !== 1 || current.previousManifestHash !== null)
          throw new Error(
            `Manifest chain for epoch ${current.lifecycleEpoch} does not start at sequence 1`
          )
        priorEpoch = current.lifecycleEpoch
        prior = stored
        continue
      }
      if (
        !prior ||
        current.sequence !== prior.manifest.sequence + 1 ||
        current.previousManifestHash !== prior.manifestHash
      )
        throw new Error(`Manifest chain is broken at ${stored.blobName}`)
      prior = stored
    }
    return manifests
  }

  private async read(
    blobName: string,
    options: {
      repairPending?: boolean
      minimumRetainUntil?: Date
      expectedVersionId?: string
      expected: Pick<
        AuditManifest,
        'liveQuizId' | 'lifecycleEpoch' | 'sequence'
      >
    }
  ): Promise<StoredAuditManifest> {
    const base = this.container.getBlockBlobClient(blobName)
    let versionId = options.expectedVersionId
    if (!versionId)
      versionId = requiredVersion(
        (await base.getProperties()) as BlobProperties,
        blobName
      )
    const version = base.withVersion(versionId)
    const bytes = await version.downloadToBuffer()
    const exact = (await version.getProperties()) as BlobProperties
    if (requiredVersion(exact, blobName) !== versionId)
      throw new Error(`Manifest ${blobName} version identity changed`)
    const parsed = parseCanonical(bytes, blobName)
    const manifest = parsed.manifest
    if (
      nameFor(manifest) !== blobName ||
      manifest.liveQuizId !== options.expected.liveQuizId ||
      manifest.lifecycleEpoch !== options.expected.lifecycleEpoch ||
      manifest.sequence !== options.expected.sequence
    )
      throw new Error(`Manifest ${blobName} does not match its scope`)
    if (
      exact.contentType !== 'application/json' ||
      !matchesBlobMetadata(exact.metadata, 'sha256', parsed.manifestHash) ||
      !matchesBlobMetadata(
        exact.metadata,
        'bytelength',
        String(bytes.byteLength)
      )
    )
      throw new Error(`Manifest ${blobName} has invalid integrity metadata`)
    const retention = new Date(manifest.retainUntil)
    const requestedRetention =
      options.minimumRetainUntil &&
      options.minimumRetainUntil.getTime() > retention.getTime()
        ? options.minimumRetainUntil
        : retention
    const expiresOn = exact.immutabilityPolicyExpiresOn
    if (expiresOn && expiresOn.getTime() <= this.now().getTime())
      throw new Error(`Manifest ${blobName} has expired retention`)
    const locked = exact.immutabilityPolicyMode?.toLowerCase() === 'locked'
    if (
      options.repairPending &&
      (!locked ||
        !expiresOn ||
        expiresOn.getTime() < requestedRetention.getTime())
    ) {
      await version.setImmutabilityPolicy({
        expiriesOn: requestedRetention,
        policyMode: 'Locked',
      })
      return this.read(blobName, { ...options, repairPending: false })
    }
    lockedUntil(exact, requestedRetention, this.now(), blobName)
    return { manifest, manifestHash: parsed.manifestHash, blobName, versionId }
  }
}

export const auditManifestBlobName = nameFor
