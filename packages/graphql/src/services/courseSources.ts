// Client for the course-sources provider (contract: ./courseSources.CONTRACT.md).
// Klicker owns lecture video source approval but knows nothing about an
// institution's course catalogue or recording platform. A provider resolves
// source links, reads the course directory (title, period, who approves) and
// proposes recording collections. Without a configured provider an admin
// enters the recipients, the period and the collection id by hand.

import { GraphQLError } from 'graphql'

const DEFAULT_TIMEOUT_MS = 20_000

export interface SourceLink {
  kind: string
  externalRef: string
  fixedCollectionId: string | null
}

export interface Period {
  label: string
  start: Date
  end: Date
}

export interface DirectoryRecipient {
  name: string
  email: string
  roles: string[]
}

export interface Directory {
  canonicalUrl: string
  title: string
  shortName: string
  recipients: DirectoryRecipient[]
  withoutEmail: string[]
  warnings: string[]
  /** Opaque provider snapshot with personal data: store and hash, never log. */
  snapshot: Record<string, unknown>
}

export interface CollectionCandidate {
  id: string
  name: string
  fullName: string
  createdAt: Date
  entriesCount: number
  recordingsInPeriod: number
  latestRecordingName: string | null
  latestRecordingAt: Date | null
  sampleRecordingNames: string[]
  recommended: boolean
}

export interface SourceResolution {
  source: SourceLink
  period: Period
  directory: Directory | null
  directoryError: string | null
  collections: CollectionCandidate[]
  collectionsError: string | null
}

export interface CourseSourcesActor {
  userId: string
  email: string | null
}

export interface CourseSourcesProvider {
  sourceLink(args: { sourceUrl: string }): Promise<SourceLink>
  directory(args: {
    directoryUrl: string
    period?: string | null
  }): Promise<{ period: Period; directory: Directory }>
  resolve(args: {
    sourceUrl: string
    directoryUrl: string
    period?: string | null
    actor: CourseSourcesActor
  }): Promise<SourceResolution>
}

export class CourseSourcesError extends GraphQLError {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number | null
  ) {
    super(message, { extensions: { code: `COURSE_SOURCES_${code}` } })
    this.name = 'CourseSourcesError'
  }
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

export interface CourseSourcesOptions {
  url?: string
  token?: string
  fetch?: FetchLike
  timeoutMs?: number
}

type Json = Record<string, unknown>

function obj(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {}
}

function str(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function strOrNull(value: unknown): string | null {
  const s = str(value)
  return s === '' ? null : s
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str).filter(Boolean) : []
}

function date(value: unknown, field: string): Date {
  const parsed = new Date(str(value))
  if (Number.isNaN(parsed.getTime())) {
    throw new CourseSourcesError(
      `Course sources provider returned an invalid ${field}`,
      'UNEXPECTED_RESPONSE',
      null
    )
  }
  return parsed
}

function toSourceLink(raw: unknown): SourceLink {
  const value = obj(raw)
  return {
    kind: str(value.kind),
    externalRef: str(value.externalRef),
    fixedCollectionId: strOrNull(value.fixedCollectionId),
  }
}

function toPeriod(raw: unknown): Period {
  const value = obj(raw)
  const label = str(value.label)
  if (!label) {
    throw new CourseSourcesError(
      'Course sources provider returned no period label',
      'UNEXPECTED_RESPONSE',
      null
    )
  }
  return {
    label,
    start: date(value.start, 'period start'),
    end: date(value.end, 'period end'),
  }
}

function toDirectory(raw: unknown): Directory {
  const value = obj(raw)
  return {
    canonicalUrl: str(value.canonicalUrl),
    title: str(value.title),
    shortName: str(value.shortName),
    recipients: (Array.isArray(value.recipients) ? value.recipients : [])
      .map(obj)
      .map((r) => ({
        name: str(r.name),
        email: str(r.email),
        roles: strings(r.roles),
      }))
      .filter((r) => r.email),
    withoutEmail: strings(value.withoutEmail),
    warnings: strings(value.warnings),
    snapshot: obj(value.snapshot),
  }
}

function toCandidate(raw: unknown): CollectionCandidate {
  const value = obj(raw)
  return {
    id: str(value.id),
    name: str(value.name),
    fullName: str(value.fullName),
    createdAt: date(value.createdAt, 'collection date'),
    entriesCount:
      typeof value.entriesCount === 'number' ? value.entriesCount : 0,
    recordingsInPeriod:
      typeof value.recordingsInPeriod === 'number'
        ? value.recordingsInPeriod
        : 0,
    latestRecordingName: strOrNull(value.latestRecordingName),
    latestRecordingAt: value.latestRecordingAt
      ? date(value.latestRecordingAt, 'recording date')
      : null,
    sampleRecordingNames: strings(value.sampleRecordingNames),
    recommended: value.recommended === true,
  }
}

export function courseSourcesConfigured(): boolean {
  return Boolean(
    process.env.COURSE_SOURCES_URL && process.env.COURSE_SOURCES_TOKEN
  )
}

export function createCourseSourcesClient(
  options: CourseSourcesOptions = {}
): CourseSourcesProvider {
  const url = (options.url ?? process.env.COURSE_SOURCES_URL ?? '').replace(
    /\/+$/,
    ''
  )
  const token = options.token ?? process.env.COURSE_SOURCES_TOKEN ?? ''
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function post(path: string, body: Json): Promise<Json> {
    if (!url || !token) {
      throw new CourseSourcesError(
        'No course sources provider is configured; enter the details by hand',
        'NOT_CONFIGURED',
        null
      )
    }
    let response: Awaited<ReturnType<FetchLike>>
    try {
      response = await fetchImpl(`${url}/course-sources/v1/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new CourseSourcesError(
        `Course sources provider unreachable: ${(error as Error).message}`,
        'UNAVAILABLE',
        null
      )
    }
    let payload: Json = {}
    try {
      payload = obj(await response.json())
    } catch {
      // Non-JSON bodies fall through to the status handling below.
    }
    if (!response.ok) {
      // 422 messages are written for admins; others stay generic.
      const message =
        response.status === 422 && str(payload.message)
          ? str(payload.message)
          : `Course sources provider answered HTTP ${response.status}`
      throw new CourseSourcesError(
        message,
        str(payload.code) || `HTTP_${response.status}`,
        response.status
      )
    }
    return payload
  }

  return {
    async sourceLink({ sourceUrl }) {
      const result = await post('source-link', { sourceUrl })
      return toSourceLink(result.source)
    },

    async directory({ directoryUrl, period }) {
      const result = await post('directory', {
        directoryUrl,
        period: period ?? null,
      })
      return {
        period: toPeriod(result.period),
        directory: toDirectory(result.directory),
      }
    },

    async resolve({ sourceUrl, directoryUrl, period, actor }) {
      const result = await post('resolve', {
        sourceUrl,
        directoryUrl,
        period: period ?? null,
        actor,
      })
      return {
        source: toSourceLink(result.source),
        period: toPeriod(result.period),
        directory: result.directory ? toDirectory(result.directory) : null,
        directoryError: strOrNull(result.directoryError),
        collections: (Array.isArray(result.collections)
          ? result.collections
          : []
        ).map(toCandidate),
        collectionsError: strOrNull(result.collectionsError),
      }
    },
  }
}
