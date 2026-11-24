// Read-only Kaltura metadata lookups that help an admin set up a lecture video
// source: find the category behind an OLAT node or MediaSpace channel and
// summarise its recordings.
//
// Klicker never holds the Kaltura token. These lookups go to the ingestion
// gateway, the single token holder, through its metadata-only lookup
// endpoints. The gateway enforces its own allow-list and writes its own
// write-ahead audit record for every Kaltura call; this client only
// identifies the acting admin.

import { GraphQLError } from 'graphql'

const KALTURA_ENTRY_READY = 2
const KALTURA_MEDIA_TYPE_VIDEO = 1
const DEFAULT_TIMEOUT_MS = 15_000

export class KalturaLookupError extends GraphQLError {
  constructor(
    message: string,
    readonly code: 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'API_ERROR'
  ) {
    super(message, { extensions: { code: `KALTURA_${code}` } })
    this.name = 'KalturaLookupError'
  }
}

export interface KalturaCategory {
  id: string
  name: string
  fullName: string
  createdAt: Date
  entriesCount: number
}

export interface KalturaEntrySummary {
  id: string
  name: string
  mediaType: number | null
  sourceType: string | null
  parentEntryId: string | null
  status: number | null
  createdAt: Date
}

export interface KalturaCatalog {
  getCategory(categoryId: string): Promise<KalturaCategory | null>
  findCategoriesForOlatNode(nodeId: string): Promise<KalturaCategory[]>
  listRecentEntries(
    categoryId: string,
    limit: number
  ): Promise<KalturaEntrySummary[]>
}

type FetchLike = (
  input: string,
  init: {
    method: 'POST'
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
  }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export interface KalturaGatewayActor {
  userId: string
  email: string | null
}

export interface KalturaCatalogOptions {
  /** The admin on whose behalf the gateway looks up; it audits this actor. */
  actor: KalturaGatewayActor
  /** Base URL of the ingestion gateway, e.g. https://gateway.internal. */
  gatewayUrl?: string
  /** Service credential for the gateway (not a Kaltura credential). */
  gatewayToken?: string
  fetch?: FetchLike
  timeoutMs?: number
}

type JsonObject = Record<string, unknown>

function str(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return null
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function date(value: unknown): Date {
  const parsed = typeof value === 'string' ? new Date(value) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0)
}

function toCategory(raw: JsonObject): KalturaCategory {
  return {
    id: str(raw.id) ?? '',
    name: str(raw.name) ?? '',
    fullName: str(raw.fullName) ?? '',
    createdAt: date(raw.createdAt),
    entriesCount: num(raw.entriesCount) ?? 0,
  }
}

function toEntry(raw: JsonObject): KalturaEntrySummary {
  return {
    id: str(raw.id) ?? '',
    name: str(raw.name) ?? '',
    mediaType: num(raw.mediaType),
    sourceType: str(raw.sourceType),
    parentEntryId: str(raw.parentEntryId) || null,
    status: num(raw.status),
    createdAt: date(raw.createdAt),
  }
}

function list(value: unknown): JsonObject[] {
  return Array.isArray(value) ? (value as JsonObject[]) : []
}

/** Kaltura category names for OLAT nodes are `<LTI context id>-<node id>`. */
export function isOlatNodeCategory(name: string, nodeId: string): boolean {
  return name.endsWith(`-${nodeId}`)
}

/**
 * A recording a lecturer would recognise: a ready video that is not the hidden
 * camera child of a capture. Display only; ingestion eligibility is decided by
 * the discovery worker.
 */
export function isVisibleRecording(entry: KalturaEntrySummary): boolean {
  return (
    entry.status === KALTURA_ENTRY_READY &&
    entry.mediaType === KALTURA_MEDIA_TYPE_VIDEO &&
    !entry.parentEntryId
  )
}

/**
 * Client for the gateway's metadata lookup endpoints:
 * POST /v1/lookup/olat-node {nodeId} -> {categories}
 * POST /v1/lookup/category {categoryId} -> {category | null}
 * POST /v1/lookup/entries {categoryId, limit} -> {entries}
 * Every body carries the acting admin; dates are ISO strings.
 */
export function createKalturaCatalog(
  options: KalturaCatalogOptions
): KalturaCatalog {
  const gatewayUrl = (
    options.gatewayUrl ??
    process.env.KALTURA_GATEWAY_URL ??
    ''
  ).replace(/\/+$/, '')
  const gatewayToken = options.gatewayToken ?? process.env.KALTURA_GATEWAY_TOKEN
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function lookup(
    path: string,
    params: Record<string, unknown>
  ): Promise<JsonObject> {
    if (!gatewayUrl || !gatewayToken) {
      throw new KalturaLookupError(
        'Kaltura lookups are not available yet (KALTURA_GATEWAY_URL and KALTURA_GATEWAY_TOKEN)',
        'NOT_CONFIGURED'
      )
    }
    let response: Awaited<ReturnType<FetchLike>>
    try {
      response = await fetchImpl(`${gatewayUrl}/v1/lookup/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify({ ...params, actor: options.actor }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new KalturaLookupError(
        `Kaltura gateway request failed: ${(error as Error).message}`,
        'UNAVAILABLE'
      )
    }
    if (!response.ok) {
      throw new KalturaLookupError(
        `Kaltura gateway answered HTTP ${response.status}`,
        response.status >= 500 ? 'UNAVAILABLE' : 'API_ERROR'
      )
    }
    const body = (await response.json()) as unknown
    return body && typeof body === 'object' ? (body as JsonObject) : {}
  }

  return {
    async getCategory(categoryId) {
      const result = await lookup('category', { categoryId })
      return result.category && typeof result.category === 'object'
        ? toCategory(result.category as JsonObject)
        : null
    },

    async findCategoriesForOlatNode(nodeId) {
      const result = await lookup('olat-node', { nodeId })
      return list(result.categories)
        .map(toCategory)
        .filter((category) => isOlatNodeCategory(category.name, nodeId))
    },

    async listRecentEntries(categoryId, limit) {
      const result = await lookup('entries', { categoryId, limit })
      return list(result.entries).map(toEntry)
    },
  }
}
