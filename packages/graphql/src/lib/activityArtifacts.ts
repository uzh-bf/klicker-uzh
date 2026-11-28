import type {
  ActivityArtifactExercise,
  ActivityArtifactPin,
} from '@klicker-uzh/types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/
// The publisher template rejects these characters in the exercise title, so
// the host rejects them before anything reaches a frame.
const UNSAFE_EXERCISE_TITLE = /[<>&\p{Cc}]/u

const MAX_EXERCISE_TITLE_LENGTH = 100
const MAX_EXERCISE_YEARS = 30
const MAX_EXERCISE_FACE = 1_000_000
const MAX_EXERCISE_CASHFLOWS = 8
const MAX_ARTIFACT_TITLE_LENGTH = 200
const MAX_ARTIFACT_VERSION = 1_000_000
const MAX_RESPONSE_LENGTH = 512 * 1024
const REQUEST_TIMEOUT_MILLISECONDS = 5000
// The publisher only accepts run claims that expire within thirty seconds. A
// five second margin keeps a claim inside that window while it travels.
const RUN_CLAIM_TTL_SECONDS = 25
const RUN_CLAIM_AUDIENCE = 'artifact-pilot'

const EXERCISE_KEYS = ['cashflows', 'face', 'title', 'years']
const CASHFLOW_KEYS = ['amount', 'when']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]) {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  )
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) return null
  return trimmed
}

export function isActivityArtifactId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/**
 * Publisher origins name the canonical author links and the fixed frame. They
 * carry no path, credentials, query or fragment, so a stored origin can be
 * concatenated with the publisher's own routes without ambiguity.
 */
export function parsePublisherOrigin(value: string | undefined) {
  if (typeof value !== 'string' || value.trim() === '') return null

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  if (url.username !== '' || url.password !== '') return null
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') return null
  if (url.origin === 'null') return null

  return url.origin
}

/**
 * The backend reaches the publisher through its internal service URL. The
 * public origin is only used for canonical author links and the trusted frame.
 * Cluster-local HTTP is allowed here; browser-facing origins remain HTTPS.
 */
export function parseArtifactServiceUrl(value: string | undefined) {
  if (typeof value !== 'string' || value.trim() === '') return null

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username !== '' || url.password !== '') return null
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') return null
  if (url.origin === 'null') return null

  return url.origin
}

/**
 * Accepts only the canonical author link form `https://{publisher origin}/a/{uuid}`
 * for the configured publisher. The returned artifact id is bound to the link
 * that was reviewed, so a later service response cannot silently switch it.
 */
export function parseCanonicalArtifactUrl(
  value: string | undefined,
  publisherOrigin: string
): { artifactId: string } | null {
  if (typeof value !== 'string' || value.trim() === '') return null

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  if (url.origin !== publisherOrigin) return null
  if (url.username !== '' || url.password !== '') return null
  if (url.search !== '' || url.hash !== '') return null

  const match = /^\/a\/([^/]+)$/.exec(url.pathname)
  if (!match) return null

  const artifactId = match[1]
  if (typeof artifactId !== 'string' || !UUID_PATTERN.test(artifactId)) {
    return null
  }

  return { artifactId }
}

/**
 * The trusted frame renders only this declarative bond exercise. It carries
 * the same fields the publisher template accepts, so markup, scripts and
 * additional fields never reach a student origin.
 */
export function validateActivityArtifactExercise(
  value: unknown
): ActivityArtifactExercise | null {
  if (!isRecord(value) || !hasExactKeys(value, EXERCISE_KEYS)) return null

  const title = value.title
  if (
    typeof title !== 'string' ||
    title.trim().length === 0 ||
    title.length > MAX_EXERCISE_TITLE_LENGTH ||
    UNSAFE_EXERCISE_TITLE.test(title)
  ) {
    return null
  }

  const years = value.years
  if (
    !Number.isInteger(years) ||
    (years as number) < 1 ||
    (years as number) > MAX_EXERCISE_YEARS
  ) {
    return null
  }

  const face = value.face
  if (!isFiniteNumber(face) || face <= 0 || face > MAX_EXERCISE_FACE) {
    return null
  }

  const cashflows = value.cashflows
  if (
    !Array.isArray(cashflows) ||
    cashflows.length === 0 ||
    cashflows.length > MAX_EXERCISE_CASHFLOWS
  ) {
    return null
  }

  const validatedCashflows: ActivityArtifactExercise['cashflows'] = []
  for (const cashflow of cashflows) {
    if (!isRecord(cashflow) || !hasExactKeys(cashflow, CASHFLOW_KEYS)) {
      return null
    }

    const when = cashflow.when
    if (when !== 'maturity' && when !== 'year-end') return null

    const amount = cashflow.amount
    if (
      amount !== 'face' &&
      (!isFiniteNumber(amount) || amount < 0 || amount > MAX_EXERCISE_FACE)
    ) {
      return null
    }

    validatedCashflows.push({ when, amount })
  }

  return {
    title,
    years: years as number,
    face,
    cashflows: validatedCashflows,
  }
}

export type ActivityArtifactRevision = {
  artifactId: string
  revisionId: string
  digest: string
  version: number
  title: string
  url: string
  renderedDigest: string
  exercise: ActivityArtifactExercise
}

/**
 * Validates a publisher response against what the caller already knows. The
 * preview markup is checked for shape and size but deliberately dropped: the
 * host renders the artifact through the isolated frame and never forwards
 * publisher markup into a Klicker origin.
 */
export function validateArtifactRevisionPayload(
  payload: unknown,
  expected: {
    publisherOrigin: string
    artifactId: string
    revisionId?: string
  }
): ActivityArtifactRevision | null {
  if (!isRecord(payload)) return null

  if (
    typeof payload.artifactId !== 'string' ||
    !UUID_PATTERN.test(payload.artifactId)
  ) {
    return null
  }
  if (payload.artifactId !== expected.artifactId) return null

  if (
    typeof payload.revisionId !== 'string' ||
    !UUID_PATTERN.test(payload.revisionId)
  ) {
    return null
  }
  if (
    typeof expected.revisionId !== 'undefined' &&
    payload.revisionId !== expected.revisionId
  ) {
    return null
  }

  if (
    typeof payload.digest !== 'string' ||
    !SHA256_PATTERN.test(payload.digest)
  )
    return null
  if (
    typeof payload.renderedDigest !== 'string' ||
    !SHA256_PATTERN.test(payload.renderedDigest)
  ) {
    return null
  }

  if (
    !isFiniteNumber(payload.version) ||
    !Number.isInteger(payload.version) ||
    payload.version < 1 ||
    payload.version > MAX_ARTIFACT_VERSION
  ) {
    return null
  }

  const title = boundedString(payload.title, MAX_ARTIFACT_TITLE_LENGTH)
  if (!title) return null

  if (typeof payload.url !== 'string') return null
  const parsedUrl = parseCanonicalArtifactUrl(
    payload.url,
    expected.publisherOrigin
  )
  if (!parsedUrl || parsedUrl.artifactId !== expected.artifactId) return null

  const exercise = validateActivityArtifactExercise(payload.exercise)
  if (!exercise) return null

  return {
    artifactId: payload.artifactId,
    revisionId: payload.revisionId,
    digest: payload.digest,
    version: payload.version,
    title,
    url: payload.url,
    renderedDigest: payload.renderedDigest,
    exercise,
  }
}

/**
 * Re-validates the stored pin shape before it is written or served. The
 * lecturer subject stayed server-side when the pin was captured and is
 * required here because later reads authenticate to the publisher as that
 * subject.
 */
export function sanitizeActivityArtifactPin(
  value: unknown
): ActivityArtifactPin | null {
  if (!isRecord(value)) return null

  const artifactId = value.artifactId
  const revisionId = value.revisionId
  if (typeof artifactId !== 'string' || !UUID_PATTERN.test(artifactId)) {
    return null
  }
  if (typeof revisionId !== 'string' || !UUID_PATTERN.test(revisionId)) {
    return null
  }
  if (typeof value.digest !== 'string' || !SHA256_PATTERN.test(value.digest)) {
    return null
  }
  if (
    typeof value.renderedDigest !== 'string' ||
    !SHA256_PATTERN.test(value.renderedDigest)
  ) {
    return null
  }
  if (
    !isFiniteNumber(value.version) ||
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    value.version > MAX_ARTIFACT_VERSION
  ) {
    return null
  }

  const title = boundedString(value.title, MAX_ARTIFACT_TITLE_LENGTH)
  if (!title) return null

  if (typeof value.url !== 'string') return null
  let urlOrigin: string
  try {
    urlOrigin = new URL(value.url).origin
  } catch {
    return null
  }
  const parsedUrl = parseCanonicalArtifactUrl(value.url, urlOrigin)
  if (!parsedUrl || parsedUrl.artifactId !== artifactId) return null

  const subject = boundedString(value.subject, 200)
  if (!subject) return null

  const exercise = validateActivityArtifactExercise(value.exercise)
  if (!exercise) return null

  return {
    artifactId,
    revisionId,
    digest: value.digest,
    version: value.version,
    title,
    url: value.url,
    renderedDigest: value.renderedDigest,
    exercise,
    subject,
  }
}

export type ActivityArtifactRunClaim = {
  participantId: string
  courseId: string
  elementInstanceId: number
  bindingInstanceId?: string
}

/**
 * A binding names one immutable instance-and-revision publication. Including
 * the revision lets a later explicit upgrade form a new binding instead of
 * colliding with an orphaned binding left by an earlier failed publication.
 */
export function getActivityArtifactBindingInstanceId(
  elementInstanceId: number,
  revisionId: string
) {
  return `${elementInstanceId}:${revisionId}`
}

export interface ActivityArtifactRuntime {
  readonly publisherOrigin: string
  readonly serviceUrl: string
  // Fixed trusted renderer route; the host never derives it from a response.
  readonly frameOrigin: string
  getLatest(input: {
    subject: string
    artifactId: string
  }): Promise<ActivityArtifactRevision>
  getRevision(input: {
    subject: string
    artifactId: string
    revisionId: string
    run?: ActivityArtifactRunClaim
  }): Promise<ActivityArtifactRevision>
  assign(input: {
    subject: string
    courseId: string
    instanceId: string
    artifactId: string
    revisionId: string
  }): Promise<'bound' | 'conflict'>
}

type FetchLike = typeof fetch

export class ActivityArtifactRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'ActivityArtifactRequestError'
  }
}

async function readBoundedResponseText(response: Response): Promise<string> {
  const declaredLength = response.headers.get('content-length')
  const length = declaredLength === null ? null : Number(declaredLength)
  if (
    length !== null &&
    Number.isSafeInteger(length) &&
    length > MAX_RESPONSE_LENGTH
  ) {
    await response.body?.cancel().catch(() => undefined)
    throw new ActivityArtifactRequestError(
      'Artifact response exceeded limit',
      response.status
    )
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_RESPONSE_LENGTH) {
      throw new ActivityArtifactRequestError(
        'Artifact response exceeded limit',
        response.status
      )
    }
    return new TextDecoder().decode(bytes)
  }

  const chunks: Uint8Array[] = []
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      received += value.byteLength
      if (received > MAX_RESPONSE_LENGTH) {
        await reader.cancel().catch(() => undefined)
        throw new ActivityArtifactRequestError(
          'Artifact response exceeded limit',
          response.status
        )
      }
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

async function requestJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit
): Promise<{ status: number; body: unknown }> {
  const response = await fetchImpl(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
  })

  const text = await readBoundedResponseText(response)

  if (text.length === 0) return { status: response.status, body: undefined }

  try {
    return { status: response.status, body: JSON.parse(text) }
  } catch {
    throw new ActivityArtifactRequestError(
      'Artifact response was not JSON',
      response.status
    )
  }
}

export function createActivityArtifactRuntime({
  publisherOrigin,
  serviceUrl,
  serviceToken,
  fetchImpl = fetch,
  now = Date.now,
}: {
  publisherOrigin: string
  serviceUrl: string
  serviceToken: string
  fetchImpl?: FetchLike
  now?: () => number
}): ActivityArtifactRuntime {
  if (serviceToken.trim() === '') {
    throw new Error('Activity artifact service token is required')
  }

  async function readRevision({
    subject,
    artifactId,
    revisionId,
    run,
  }: {
    subject: string
    artifactId: string
    revisionId?: string
    run?: ActivityArtifactRunClaim
  }): Promise<ActivityArtifactRevision> {
    if (!isActivityArtifactId(artifactId)) {
      throw new ActivityArtifactRequestError('Invalid artifact id')
    }
    if (
      typeof revisionId !== 'undefined' &&
      !isActivityArtifactId(revisionId)
    ) {
      throw new ActivityArtifactRequestError('Invalid artifact revision id')
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${serviceToken}`,
      'x-artifact-subject': subject,
    }

    if (run) {
      if (run.participantId !== subject) {
        throw new ActivityArtifactRequestError(
          'Run participant does not match the authenticated subject'
        )
      }
      headers['x-artifact-operation'] = 'run'
      headers['x-artifact-course'] = run.courseId
      headers['x-artifact-instance'] =
        run.bindingInstanceId ?? String(run.elementInstanceId)
      headers['x-artifact-expires'] = String(
        Math.floor(now() / 1000) + RUN_CLAIM_TTL_SECONDS
      )
      headers['x-artifact-audience'] = RUN_CLAIM_AUDIENCE
    }

    const path =
      typeof revisionId === 'undefined'
        ? `/v1/artifacts/${artifactId}`
        : `/v1/artifacts/${artifactId}/revisions/${revisionId}`

    const { status, body } = await requestJson(
      fetchImpl,
      `${serviceUrl}${path}`,
      { method: 'GET', headers }
    )

    if (status < 200 || status > 299) {
      throw new ActivityArtifactRequestError(
        `Artifact lookup failed with status ${status}`,
        status
      )
    }

    const revision = validateArtifactRevisionPayload(body, {
      publisherOrigin,
      artifactId,
      revisionId,
    })
    if (!revision) {
      throw new ActivityArtifactRequestError(
        'Artifact response did not match the expected contract'
      )
    }

    return revision
  }

  return {
    publisherOrigin,
    serviceUrl,
    frameOrigin: publisherOrigin,
    getLatest: ({ subject, artifactId }) =>
      readRevision({ subject, artifactId }),
    getRevision: ({ subject, artifactId, revisionId, run }) =>
      readRevision({ subject, artifactId, revisionId, run }),
    async assign({ subject, courseId, instanceId, artifactId, revisionId }) {
      if (
        !isActivityArtifactId(artifactId) ||
        !isActivityArtifactId(revisionId)
      ) {
        throw new ActivityArtifactRequestError('Invalid artifact assignment')
      }

      const { status } = await requestJson(
        fetchImpl,
        `${serviceUrl}/v1/assignments`,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${serviceToken}`,
            'content-type': 'application/json',
            'x-artifact-subject': subject,
          },
          body: JSON.stringify({
            courseId,
            instanceId,
            artifactId,
            revisionId,
          }),
        }
      )

      if (status === 409) return 'conflict'
      if (status < 200 || status > 299) {
        throw new ActivityArtifactRequestError(
          `Artifact assignment failed with status ${status}`,
          status
        )
      }
      return 'bound'
    },
  }
}

/**
 * Absent or incomplete configuration disables the pilot. The token is only
 * required at runtime and never logged.
 */
export function createActivityArtifactRuntimeFromEnv(
  env: Record<string, string | undefined>
): ActivityArtifactRuntime | undefined {
  const publisherOrigin = parsePublisherOrigin(env.ACTIVITY_ARTIFACT_ORIGIN)
  const serviceUrl = parseArtifactServiceUrl(env.ACTIVITY_ARTIFACT_SERVICE_URL)
  const serviceToken = env.ACTIVITY_ARTIFACT_SERVICE_TOKEN?.trim()

  if (!publisherOrigin || !serviceUrl || !serviceToken) {
    if (
      env.ACTIVITY_ARTIFACT_ORIGIN ||
      env.ACTIVITY_ARTIFACT_SERVICE_URL ||
      env.ACTIVITY_ARTIFACT_SERVICE_TOKEN
    ) {
      console.warn(
        '[activity-artifacts] incomplete configuration; artifact surfaces stay disabled'
      )
    }
    return undefined
  }

  return createActivityArtifactRuntime({
    publisherOrigin,
    serviceUrl,
    serviceToken,
  })
}
