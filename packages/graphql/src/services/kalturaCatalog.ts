// Read-only SWITCH Kaltura lookups that help an admin set up a lecture video
// source: find the category behind an OLAT node or MediaSpace channel and
// summarise its recordings. Nothing here downloads media; ingestion runs in
// the discovery worker and only for approved sources.

import { createHash } from 'node:crypto'
import { GraphQLError } from 'graphql'

export const KALTURA_DEFAULT_SERVICE_URL = 'https://api.cast.switch.ch'
export const KALTURA_DEFAULT_PARTNER_ID = '106'

const KALTURA_ENTRY_READY = 2
const KALTURA_MEDIA_TYPE_VIDEO = 1
const DEFAULT_TIMEOUT_MS = 15_000
const SESSION_EXPIRY_SECONDS = 3600

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

export interface KalturaCatalogOptions {
  serviceUrl?: string
  partnerId?: string
  appTokenId?: string
  appToken?: string
  fetch?: FetchLike
  timeoutMs?: number
}

type KalturaObject = Record<string, unknown>

function str(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return null
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function fromUnix(value: unknown): Date {
  return new Date((num(value) ?? 0) * 1000)
}

function toCategory(raw: KalturaObject): KalturaCategory {
  return {
    id: str(raw.id) ?? '',
    name: str(raw.name) ?? '',
    fullName: str(raw.fullName) ?? '',
    createdAt: fromUnix(raw.createdAt),
    entriesCount: num(raw.entriesCount) ?? 0,
  }
}

function toEntry(raw: KalturaObject): KalturaEntrySummary {
  return {
    id: str(raw.id) ?? '',
    name: str(raw.name) ?? '',
    mediaType: num(raw.mediaType),
    sourceType: str(raw.sourceType),
    parentEntryId: str(raw.parentEntryId) || null,
    status: num(raw.status),
    createdAt: fromUnix(raw.createdAt),
  }
}

/** Kaltura category names for OLAT nodes are `<LTI context id>-<node id>`. */
export function isOlatNodeCategory(name: string, nodeId: string): boolean {
  return name.endsWith(`-${nodeId}`)
}

/**
 * A recording a lecturer would recognise: a ready video that is not the hidden
 * camera child of a capture.
 */
export function isVisibleRecording(entry: KalturaEntrySummary): boolean {
  return (
    entry.status === KALTURA_ENTRY_READY &&
    entry.mediaType === KALTURA_MEDIA_TYPE_VIDEO &&
    !entry.parentEntryId
  )
}

export function createKalturaCatalog(
  options: KalturaCatalogOptions = {}
): KalturaCatalog {
  const serviceUrl = (
    options.serviceUrl ??
    process.env.KALTURA_SERVICE_URL ??
    KALTURA_DEFAULT_SERVICE_URL
  ).replace(/\/+$/, '')
  const partnerId =
    options.partnerId ??
    process.env.KALTURA_PARTNER_ID ??
    KALTURA_DEFAULT_PARTNER_ID
  const appTokenId = options.appTokenId ?? process.env.KALTURA_APP_TOKEN_ID
  const appToken = options.appToken ?? process.env.KALTURA_APP_TOKEN
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let session: { ks: string; expiresAt: number } | null = null

  async function call(
    service: string,
    action: string,
    params: Record<string, unknown>
  ): Promise<KalturaObject> {
    let response: Awaited<ReturnType<FetchLike>>
    try {
      response = await fetchImpl(
        `${serviceUrl}/api_v3/service/${service}/action/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ format: 1, ...params }),
          signal: AbortSignal.timeout(timeoutMs),
        }
      )
    } catch (error) {
      throw new KalturaLookupError(
        `Kaltura request failed: ${(error as Error).message}`,
        'UNAVAILABLE'
      )
    }
    if (!response.ok) {
      throw new KalturaLookupError(
        `Kaltura answered HTTP ${response.status}`,
        'UNAVAILABLE'
      )
    }
    const body = (await response.json()) as KalturaObject | string | null
    if (
      body &&
      typeof body === 'object' &&
      body.objectType === 'KalturaAPIException'
    ) {
      throw new KalturaLookupError(
        `Kaltura ${service}.${action} failed: ${str(body.code) ?? 'error'}`,
        'API_ERROR'
      )
    }
    return typeof body === 'object' && body !== null ? body : { value: body }
  }

  async function ks(): Promise<string> {
    if (!appTokenId || !appToken) {
      throw new KalturaLookupError(
        'Kaltura lookups are not configured (KALTURA_APP_TOKEN_ID and KALTURA_APP_TOKEN)',
        'NOT_CONFIGURED'
      )
    }
    if (session && session.expiresAt > Date.now() + 60_000) return session.ks
    const widget = await call('session', 'startWidgetSession', {
      widgetId: `_${partnerId}`,
    })
    const widgetKs = str(widget.ks)
    if (!widgetKs) {
      throw new KalturaLookupError(
        'Kaltura returned no widget session',
        'API_ERROR'
      )
    }
    const tokenHash = createHash('sha256')
      .update(widgetKs + appToken)
      .digest('hex')
    const started = await call('appToken', 'startSession', {
      ks: widgetKs,
      id: appTokenId,
      tokenHash,
      expiry: SESSION_EXPIRY_SECONDS,
    })
    const appKs = str(started.ks)
    if (!appKs) {
      throw new KalturaLookupError(
        'Kaltura returned no app token session',
        'API_ERROR'
      )
    }
    session = {
      ks: appKs,
      expiresAt: Date.now() + SESSION_EXPIRY_SECONDS * 1000,
    }
    return appKs
  }

  function objects(result: KalturaObject): KalturaObject[] {
    return Array.isArray(result.objects)
      ? (result.objects as KalturaObject[])
      : []
  }

  return {
    async getCategory(categoryId) {
      try {
        return toCategory(
          await call('category', 'get', { ks: await ks(), id: categoryId })
        )
      } catch (error) {
        if (error instanceof KalturaLookupError && error.code === 'API_ERROR') {
          return null
        }
        throw error
      }
    },

    async findCategoriesForOlatNode(nodeId) {
      const result = await call('category', 'list', {
        ks: await ks(),
        filter: { objectType: 'KalturaCategoryFilter', freeText: nodeId },
        pager: { objectType: 'KalturaFilterPager', pageSize: 100 },
      })
      return objects(result)
        .map(toCategory)
        .filter((category) => isOlatNodeCategory(category.name, nodeId))
    },

    async listRecentEntries(categoryId, limit) {
      const session = await ks()
      const links = await call('categoryEntry', 'list', {
        ks: session,
        filter: {
          objectType: 'KalturaCategoryEntryFilter',
          categoryIdEqual: categoryId,
          orderBy: '-createdAt',
        },
        pager: { objectType: 'KalturaFilterPager', pageSize: limit },
      })
      const ids = objects(links)
        .map((link) => str(link.entryId))
        .filter((id): id is string => Boolean(id))
      if (ids.length === 0) return []
      const entries = await call('baseEntry', 'list', {
        ks: session,
        filter: { objectType: 'KalturaBaseEntryFilter', idIn: ids.join(',') },
        pager: { objectType: 'KalturaFilterPager', pageSize: ids.length },
      })
      return objects(entries).map(toEntry)
    },
  }
}
