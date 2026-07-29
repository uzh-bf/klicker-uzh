import type {
  CodeSubmissionResult,
  CodeTestCase,
  JsonValue,
} from '@klicker-uzh/types'
import { importPKCS8, SignJWT } from 'jose'
import { createHash, randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

const CODEAPI_PRINCIPAL_SOURCE = 'klicker_jwt'
const MAX_TOKEN_TTL_SECONDS = 300
const MAX_INVOCATIONS = 20
const MAX_RESPONSE_BYTES = 256 * 1024
const MAX_RUNNER_OUTPUT_CHARS = 4_096
const MAX_EXCEPTION_CHARS = 2_048
const MAX_JSON_DEPTH = 20
const MAX_JSON_NODES = 2_000

const CHILD_RUNNER = String.raw`
import contextlib
import io
import json
import sys
import traceback

MAX_TEXT_CHARS = 4096
MAX_EXCEPTION_CHARS = 2048


class CappedTextIO(io.TextIOBase):
    def __init__(self, limit):
        self.limit = limit
        self.parts = []
        self.length = 0

    def writable(self):
        return True

    def write(self, value):
        text = str(value)
        remaining = self.limit - self.length
        if remaining > 0:
            part = text[:remaining]
            self.parts.append(part)
            self.length += len(part)
        return len(text)

    def flush(self):
        return None

    def getvalue(self):
        return "".join(self.parts)


payload = json.loads(sys.stdin.read())
captured_stdout = CappedTextIO(MAX_TEXT_CHARS)
captured_stderr = CappedTextIO(MAX_TEXT_CHARS)

try:
    namespace = {"__name__": "__student__"}
    with contextlib.redirect_stdout(captured_stdout), contextlib.redirect_stderr(captured_stderr):
        exec(compile(payload["studentCode"], "<student>", "exec"), namespace, namespace)
        entrypoint = namespace[payload["entrypoint"]]
        if not callable(entrypoint):
            raise TypeError("entrypoint is not callable")
        actual_output = entrypoint(*payload["args"])
        json.dumps(actual_output, allow_nan=False)

    result = {
        "status": "ok",
        "actualOutput": actual_output,
        "stdout": captured_stdout.getvalue(),
        "stderr": captured_stderr.getvalue(),
    }
except BaseException as error:
    exception = "".join(
        traceback.format_exception_only(type(error), error)
    ).strip()[:MAX_EXCEPTION_CHARS]
    result = {
        "status": "error",
        "stdout": captured_stdout.getvalue(),
        "stderr": captured_stderr.getvalue(),
        "exception": exception,
    }

sys.stdout.write(
    json.dumps(
        result,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
    )
)
`

export type CodeApiJwtAlgorithm = 'EdDSA' | 'RS256'
export type CodeApiVisibility = 'public' | 'hidden'

export interface CodeApiClientConfig {
  baseUrl: string
  issuer: string
  audience: string
  tenantId: string
  privateKeyPem: string
  keyId: string
  algorithm: CodeApiJwtAlgorithm
  tokenTtlSeconds: number
  requestTimeoutMs: number
}

export interface CodeApiInvocation {
  id: string
  args: JsonValue[]
}

export interface CodeApiExecutionRequestInput {
  studentCode: string
  entrypoint: string
  invocations: CodeApiInvocation[]
  perTestTimeoutSeconds: number
}

export interface CodeApiExecutionRequest {
  lang: 'python'
  code: string
}

export type CodeApiInvocationOutcome =
  | {
      id: string
      status: 'ok'
      actualOutput: JsonValue
      stdout: string
      stderr: string
    }
  | {
      id: string
      status: 'error'
      stdout: string
      stderr: string
      exception?: string
    }
  | {
      id: string
      status: 'timeout'
      stdout: string
      stderr: string
    }

export interface CodeApiBatchResult {
  visibility: CodeApiVisibility
  sessionId: string
  outcomes: CodeApiInvocationOutcome[]
}

export interface CodeApiBatchExecutionInput {
  subject: string
  role?: string
  studentCode: string
  entrypoint: string
  publicInvocations?: CodeApiInvocation[]
  hiddenInvocations?: CodeApiInvocation[]
  perTestTimeoutSeconds: number
}

export interface CodeApiBatchExecutionResult {
  public?: CodeApiBatchResult
  hidden?: CodeApiBatchResult
}

export type CodeApiClientErrorKind =
  | 'config'
  | 'request'
  | 'request_timeout'
  | 'http'
  | 'rate_limit'
  | 'response'
  | 'runner'
  | 'session_reuse'

export class CodeApiClientError extends Error {
  readonly kind: CodeApiClientErrorKind
  readonly status?: number
  readonly retryAfterSeconds?: number

  constructor(
    kind: CodeApiClientErrorKind,
    message: string,
    options: {
      cause?: unknown
      status?: number
      retryAfterSeconds?: number
    } = {}
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'CodeApiClientError'
    this.kind = kind
    this.status = options.status
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

function requireString(value: string, label: string, maxLength = 512): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new CodeApiClientError('config', `${label} is invalid`)
  }
  return normalized
}

function normalizeBaseUrl(value: string): string {
  const raw = requireString(value, 'CodeAPI base URL', 2_048)
  let url: URL
  try {
    url = new URL(raw)
  } catch (error) {
    throw new CodeApiClientError('config', 'CodeAPI base URL is invalid', {
      cause: error,
    })
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CodeApiClientError(
      'config',
      'CodeAPI base URL must use HTTP or HTTPS'
    )
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new CodeApiClientError(
      'config',
      'CodeAPI base URL must not contain credentials, query, or fragment'
    )
  }
  if (
    url.protocol === 'http:' &&
    !['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  ) {
    throw new CodeApiClientError(
      'config',
      'CodeAPI base URL must use HTTPS outside localhost'
    )
  }

  return url.toString().replace(/\/$/, '')
}

function normalizeConfig(config: CodeApiClientConfig): CodeApiClientConfig {
  const tokenTtlSeconds = Number(config.tokenTtlSeconds)
  if (
    !Number.isInteger(tokenTtlSeconds) ||
    tokenTtlSeconds < 1 ||
    tokenTtlSeconds > MAX_TOKEN_TTL_SECONDS
  ) {
    throw new CodeApiClientError(
      'config',
      `CodeAPI JWT lifetime must be between 1 and ${MAX_TOKEN_TTL_SECONDS} seconds`
    )
  }

  const requestTimeoutMs = Number(config.requestTimeoutMs)
  if (
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1_000 ||
    requestTimeoutMs > MAX_TOKEN_TTL_SECONDS * 1_000
  ) {
    throw new CodeApiClientError(
      'config',
      'CodeAPI request timeout must be between 1000 and 300000 milliseconds'
    )
  }

  if (config.algorithm !== 'EdDSA' && config.algorithm !== 'RS256') {
    throw new CodeApiClientError(
      'config',
      'CodeAPI JWT algorithm must be EdDSA or RS256'
    )
  }

  const privateKeyPem = requireString(
    config.privateKeyPem.replaceAll('\\n', '\n'),
    'CodeAPI JWT private key',
    32_768
  )

  return {
    baseUrl: normalizeBaseUrl(config.baseUrl),
    issuer: requireString(config.issuer, 'CodeAPI JWT issuer'),
    audience: requireString(config.audience, 'CodeAPI JWT audience'),
    tenantId: requireString(config.tenantId, 'CodeAPI tenant id', 256),
    privateKeyPem,
    keyId: requireString(config.keyId, 'CodeAPI JWT key id', 256),
    algorithm: config.algorithm,
    tokenTtlSeconds,
    requestTimeoutMs,
  }
}

function readNumber(
  value: string | undefined,
  fallback: number,
  label: string
): number {
  if (typeof value === 'undefined' || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new CodeApiClientError('config', `${label} is invalid`)
  }
  return parsed
}

export function loadCodeApiConfig(
  env: NodeJS.ProcessEnv = process.env
): CodeApiClientConfig {
  return normalizeConfig({
    baseUrl: env.CODEAPI_BASE_URL ?? '',
    issuer: env.CODEAPI_JWT_ISSUER ?? '',
    audience: env.CODEAPI_JWT_AUDIENCE ?? '',
    tenantId: env.CODEAPI_TENANT_ID ?? '',
    privateKeyPem: env.CODEAPI_JWT_PRIVATE_KEY ?? '',
    keyId: env.CODEAPI_JWT_KEY_ID ?? '',
    algorithm: (env.CODEAPI_JWT_ALGORITHM ?? 'EdDSA') as CodeApiJwtAlgorithm,
    tokenTtlSeconds: readNumber(
      env.CODEAPI_JWT_TTL_SECONDS,
      60,
      'CodeAPI JWT lifetime'
    ),
    requestTimeoutMs: readNumber(
      env.CODEAPI_REQUEST_TIMEOUT_MS,
      120_000,
      'CodeAPI request timeout'
    ),
  })
}

export function buildCodeApiAuthContextHash(input: {
  subject: string
  tenantId: string
  role?: string
}): string {
  const subject = requireString(input.subject, 'CodeAPI JWT subject', 256)
  const tenantId = requireString(input.tenantId, 'CodeAPI tenant id', 256)
  const role = input.role?.trim() ?? ''
  return createHash('sha256')
    .update(JSON.stringify({ role, subject, tenantId }))
    .digest('base64url')
}

export async function mintCodeApiJwt(
  rawConfig: CodeApiClientConfig,
  claims: {
    subject: string
    role?: string
  },
  options: {
    nowSeconds?: number
    jti?: string
  } = {}
): Promise<string> {
  const config = normalizeConfig(rawConfig)
  const subject = requireString(claims.subject, 'CodeAPI JWT subject', 256)
  const role = claims.role
    ? requireString(claims.role, 'CodeAPI JWT role', 128)
    : undefined
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1_000)
  const jti = requireString(options.jti ?? randomUUID(), 'CodeAPI JWT id', 256)

  if (!Number.isInteger(nowSeconds) || nowSeconds < 0) {
    throw new CodeApiClientError('config', 'CodeAPI JWT time is invalid')
  }

  let privateKey
  try {
    privateKey = await importPKCS8(config.privateKeyPem, config.algorithm)
  } catch (error) {
    throw new CodeApiClientError(
      'config',
      'CodeAPI JWT private key is invalid',
      { cause: error }
    )
  }

  return new SignJWT({
    tenant_id: config.tenantId,
    ...(role ? { role } : {}),
    principal_source: CODEAPI_PRINCIPAL_SOURCE,
    auth_context_hash: buildCodeApiAuthContextHash({
      subject,
      tenantId: config.tenantId,
      role,
    }),
  })
    .setProtectedHeader({
      alg: config.algorithm,
      kid: config.keyId,
      typ: 'JWT',
    })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(subject)
    .setJti(jti)
    .setIssuedAt(nowSeconds)
    .setNotBefore(nowSeconds)
    .setExpirationTime(nowSeconds + config.tokenTtlSeconds)
    .sign(privateKey)
}

function assertJsonValue(
  value: unknown,
  label: string
): asserts value is JsonValue {
  const stack: Array<{ depth: number; value: unknown }> = [{ depth: 0, value }]
  let nodes = 0

  while (stack.length > 0) {
    const current = stack.pop()!
    nodes += 1
    if (nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) {
      throw new CodeApiClientError('response', `${label} is too complex`)
    }

    if (
      current.value === null ||
      typeof current.value === 'string' ||
      typeof current.value === 'boolean'
    ) {
      continue
    }
    if (typeof current.value === 'number') {
      if (!Number.isFinite(current.value)) {
        throw new CodeApiClientError('response', `${label} is not valid JSON`)
      }
      continue
    }
    if (Array.isArray(current.value)) {
      for (const item of current.value) {
        stack.push({ depth: current.depth + 1, value: item })
      }
      continue
    }
    if (
      typeof current.value === 'object' &&
      Object.getPrototypeOf(current.value) === Object.prototype
    ) {
      for (const item of Object.values(current.value)) {
        stack.push({ depth: current.depth + 1, value: item })
      }
      continue
    }

    throw new CodeApiClientError('response', `${label} is not valid JSON`)
  }
}

function validateInvocationId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new CodeApiClientError('response', `${label} is invalid`)
  }
  return value
}

function validateExecutionInput(input: CodeApiExecutionRequestInput): void {
  if (
    typeof input.studentCode !== 'string' ||
    input.studentCode.length === 0 ||
    input.studentCode.length > 100_000
  ) {
    throw new CodeApiClientError('request', 'Student code is invalid')
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.entrypoint)) {
    throw new CodeApiClientError('request', 'CODE entrypoint is invalid')
  }
  if (
    !Number.isInteger(input.perTestTimeoutSeconds) ||
    input.perTestTimeoutSeconds < 1 ||
    input.perTestTimeoutSeconds > 5
  ) {
    throw new CodeApiClientError(
      'request',
      'Per-test timeout must be between 1 and 5 seconds'
    )
  }
  if (
    !Array.isArray(input.invocations) ||
    input.invocations.length === 0 ||
    input.invocations.length > MAX_INVOCATIONS
  ) {
    throw new CodeApiClientError(
      'request',
      `A CODE batch must contain between 1 and ${MAX_INVOCATIONS} invocations`
    )
  }

  const ids = new Set<string>()
  for (const invocation of input.invocations) {
    const id = validateInvocationId(invocation.id, 'Invocation id')
    if (ids.has(id)) {
      throw new CodeApiClientError(
        'request',
        'CODE invocation ids must be unique'
      )
    }
    ids.add(id)
    if (!Array.isArray(invocation.args)) {
      throw new CodeApiClientError(
        'request',
        'CODE invocation arguments must be an array'
      )
    }
    assertJsonValue(invocation.args, 'CODE invocation arguments')
  }
}

export function buildCodeApiExecutionRequest(
  input: CodeApiExecutionRequestInput
): CodeApiExecutionRequest {
  validateExecutionInput(input)

  const encodedPayload = Buffer.from(
    JSON.stringify({
      studentCode: input.studentCode,
      entrypoint: input.entrypoint,
      invocations: input.invocations,
    }),
    'utf8'
  ).toString('base64')
  const encodedChildRunner = Buffer.from(CHILD_RUNNER, 'utf8').toString(
    'base64'
  )

  const code = String.raw`
import base64
import json
import subprocess
import sys

PER_TEST_TIMEOUT_SECONDS = ${input.perTestTimeoutSeconds}
MAX_CHILD_RESPONSE_CHARS = ${MAX_RUNNER_OUTPUT_CHARS * 2 + MAX_EXCEPTION_CHARS + 2_048}
PAYLOAD = json.loads(base64.b64decode("${encodedPayload}").decode("utf-8"))
CHILD_RUNNER = base64.b64decode("${encodedChildRunner}").decode("utf-8")


def capped(value, limit):
    return value[:limit] if isinstance(value, str) else ""


def run_invocation(invocation):
    child_payload = {
        "studentCode": PAYLOAD["studentCode"],
        "entrypoint": PAYLOAD["entrypoint"],
        "args": invocation["args"],
    }
    try:
        completed = subprocess.run(
            [sys.executable, "-I", "-c", CHILD_RUNNER],
            input=json.dumps(child_payload, ensure_ascii=False),
            capture_output=True,
            text=True,
            timeout=PER_TEST_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {
            "id": invocation["id"],
            "status": "timeout",
            "stdout": "",
            "stderr": "",
        }

    if (
        completed.returncode != 0
        or len(completed.stdout) > MAX_CHILD_RESPONSE_CHARS
    ):
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": capped(completed.stderr, ${MAX_RUNNER_OUTPUT_CHARS}),
            "exception": "child_process_failed",
        }

    try:
        child_result = json.loads(completed.stdout)
    except (TypeError, ValueError):
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": capped(completed.stderr, ${MAX_RUNNER_OUTPUT_CHARS}),
            "exception": "invalid_child_result",
        }

    if not isinstance(child_result, dict) or child_result.get("status") not in (
        "ok",
        "error",
    ):
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": "",
            "exception": "invalid_child_result",
        }

    child_result["id"] = invocation["id"]
    return child_result


outcomes = [run_invocation(invocation) for invocation in PAYLOAD["invocations"]]
sys.stdout.write(
    json.dumps(
        {"version": 1, "outcomes": outcomes},
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
    )
)
`.trim()

  return { lang: 'python', code }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new CodeApiClientError('response', `${label} is invalid`)
  }
  return value as Record<string, unknown>
}

function assertOnlyKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void {
  const allowedKeys = new Set(allowed)
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    throw new CodeApiClientError(
      'response',
      `${label} contains unsupported fields`
    )
  }
}

function cappedString(
  value: unknown,
  label: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    throw new CodeApiClientError('response', `${label} is invalid`)
  }
  return value.slice(0, maxLength)
}

export function parseCodeApiRunnerOutput(
  stdout: string
): CodeApiInvocationOutcome[] {
  if (
    typeof stdout !== 'string' ||
    stdout.length === 0 ||
    stdout.length > MAX_RESPONSE_BYTES
  ) {
    throw new CodeApiClientError('runner', 'CodeAPI runner output is invalid')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch (error) {
    throw new CodeApiClientError(
      'runner',
      'CodeAPI runner output is not valid JSON',
      { cause: error }
    )
  }

  const envelope = asRecord(parsed, 'CodeAPI runner output')
  assertOnlyKeys(envelope, ['version', 'outcomes'], 'CodeAPI runner output')
  if (envelope.version !== 1 || !Array.isArray(envelope.outcomes)) {
    throw new CodeApiClientError('runner', 'CodeAPI runner output is invalid')
  }
  if (envelope.outcomes.length > MAX_INVOCATIONS) {
    throw new CodeApiClientError(
      'runner',
      'CodeAPI runner returned too many outcomes'
    )
  }

  const ids = new Set<string>()
  return envelope.outcomes.map((rawOutcome, index) => {
    const outcome = asRecord(rawOutcome, `CodeAPI outcome ${index}`)
    const id = validateInvocationId(outcome.id, `CodeAPI outcome ${index} id`)
    if (ids.has(id)) {
      throw new CodeApiClientError(
        'runner',
        'CodeAPI runner returned duplicate outcome ids'
      )
    }
    ids.add(id)

    const stdoutValue = cappedString(
      outcome.stdout,
      `CodeAPI outcome ${index} stdout`,
      MAX_RUNNER_OUTPUT_CHARS
    )
    const stderrValue = cappedString(
      outcome.stderr,
      `CodeAPI outcome ${index} stderr`,
      MAX_RUNNER_OUTPUT_CHARS
    )

    if (outcome.status === 'ok') {
      assertOnlyKeys(
        outcome,
        ['id', 'status', 'actualOutput', 'stdout', 'stderr'],
        `CodeAPI outcome ${index}`
      )
      if (!Object.hasOwn(outcome, 'actualOutput')) {
        throw new CodeApiClientError(
          'runner',
          'Successful CodeAPI outcome has no output'
        )
      }
      assertJsonValue(
        outcome.actualOutput,
        `CodeAPI outcome ${index} actual output`
      )
      return {
        id,
        status: 'ok' as const,
        actualOutput: outcome.actualOutput,
        stdout: stdoutValue,
        stderr: stderrValue,
      }
    }

    if (outcome.status === 'error') {
      assertOnlyKeys(
        outcome,
        ['id', 'status', 'stdout', 'stderr', 'exception'],
        `CodeAPI outcome ${index}`
      )
      const exception =
        typeof outcome.exception === 'undefined'
          ? undefined
          : cappedString(
              outcome.exception,
              `CodeAPI outcome ${index} exception`,
              MAX_EXCEPTION_CHARS
            )
      return {
        id,
        status: 'error' as const,
        stdout: stdoutValue,
        stderr: stderrValue,
        ...(exception ? { exception } : {}),
      }
    }

    if (outcome.status === 'timeout') {
      assertOnlyKeys(
        outcome,
        ['id', 'status', 'stdout', 'stderr'],
        `CodeAPI outcome ${index}`
      )
      return {
        id,
        status: 'timeout' as const,
        stdout: stdoutValue,
        stderr: stderrValue,
      }
    }

    throw new CodeApiClientError(
      'runner',
      `CodeAPI outcome ${index} status is invalid`
    )
  })
}

interface ParsedExecuteResponse {
  sessionId: string
  outcomes: CodeApiInvocationOutcome[]
}

function parseExecuteResponse(value: unknown): ParsedExecuteResponse {
  const response = asRecord(value, 'CodeAPI response')
  assertOnlyKeys(
    response,
    [
      'session_id',
      'stdout',
      'stderr',
      'files',
      'code',
      'signal',
      'message',
      'status',
      'wall_time',
    ],
    'CodeAPI response'
  )
  const sessionId = validateInvocationId(
    response.session_id,
    'CodeAPI session id'
  )
  if (!Array.isArray(response.files) || response.files.length > 50) {
    throw new CodeApiClientError('response', 'CodeAPI files are invalid')
  }
  if (response.files.length > 0) {
    throw new CodeApiClientError(
      'runner',
      'CodeAPI grading runner produced unexpected files'
    )
  }
  if (typeof response.stderr !== 'string') {
    throw new CodeApiClientError('response', 'CodeAPI stderr is invalid')
  }
  if (
    typeof response.code !== 'undefined' &&
    response.code !== null &&
    (typeof response.code !== 'number' || !Number.isInteger(response.code))
  ) {
    throw new CodeApiClientError('response', 'CodeAPI exit code is invalid')
  }
  if (typeof response.code === 'number' && response.code !== 0) {
    throw new CodeApiClientError('runner', 'CodeAPI runner process failed')
  }
  if (
    typeof response.signal !== 'undefined' &&
    response.signal !== null &&
    typeof response.signal !== 'string'
  ) {
    throw new CodeApiClientError('response', 'CodeAPI signal is invalid')
  }
  if (typeof response.signal === 'string' && response.signal.length > 0) {
    throw new CodeApiClientError('runner', 'CodeAPI runner was interrupted')
  }
  for (const field of ['message', 'status'] as const) {
    const value = response[field]
    if (
      typeof value !== 'undefined' &&
      value !== null &&
      (typeof value !== 'string' || value.length > 1_024)
    ) {
      throw new CodeApiClientError('response', `CodeAPI ${field} is invalid`)
    }
  }
  if (
    typeof response.wall_time !== 'undefined' &&
    response.wall_time !== null &&
    (typeof response.wall_time !== 'number' ||
      !Number.isFinite(response.wall_time) ||
      response.wall_time < 0)
  ) {
    throw new CodeApiClientError('response', 'CodeAPI wall time is invalid')
  }

  return {
    sessionId,
    outcomes: parseCodeApiRunnerOutput(
      cappedString(response.stdout, 'CodeAPI stdout', MAX_RESPONSE_BYTES)
    ),
  }
}

async function readLimitedResponseBody(response: Response): Promise<string> {
  if (!response.body) {
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new CodeApiClientError('response', 'CodeAPI response is too large')
    }
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new CodeApiClientError('response', 'CodeAPI response is too large')
    }
    text += decoder.decode(value, { stream: true })
  }

  return text + decoder.decode()
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds)
  }
  const timestamp = Date.parse(value)
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, Math.ceil((timestamp - Date.now()) / 1_000))
  }
  return undefined
}

export function createCodeApiClient(
  rawConfig: CodeApiClientConfig,
  dependencies: {
    fetch?: typeof fetch
    nowSeconds?: () => number
    randomUUID?: () => string
  } = {}
) {
  const config = normalizeConfig(rawConfig)
  const fetchImplementation = dependencies.fetch ?? globalThis.fetch
  const nowSeconds =
    dependencies.nowSeconds ?? (() => Math.floor(Date.now() / 1_000))
  const createRequestId = dependencies.randomUUID ?? randomUUID

  async function executeBatch(
    visibility: CodeApiVisibility,
    input: CodeApiBatchExecutionInput,
    invocations: CodeApiInvocation[]
  ): Promise<CodeApiBatchResult> {
    const token = await mintCodeApiJwt(
      config,
      {
        subject: input.subject,
        role: input.role,
      },
      {
        nowSeconds: nowSeconds(),
        jti: createRequestId(),
      }
    )
    const request = buildCodeApiExecutionRequest({
      studentCode: input.studentCode,
      entrypoint: input.entrypoint,
      invocations,
      perTestTimeoutSeconds: input.perTestTimeoutSeconds,
    })

    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      config.requestTimeoutMs
    )
    let response: Response
    let responseText: string
    try {
      response = await fetchImplementation(`${config.baseUrl}/v1/exec`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
      responseText = await readLimitedResponseBody(response)
    } catch (error) {
      if (controller.signal.aborted) {
        throw new CodeApiClientError(
          'request_timeout',
          'CodeAPI request timed out',
          { cause: error }
        )
      }
      if (error instanceof CodeApiClientError) throw error
      throw new CodeApiClientError('request', 'CodeAPI request failed', {
        cause: error,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const retryAfterSeconds = parseRetryAfter(
        response.headers.get('Retry-After')
      )
      throw new CodeApiClientError(
        response.status === 429 ? 'rate_limit' : 'http',
        `CodeAPI request failed with status ${response.status}`,
        {
          status: response.status,
          ...(typeof retryAfterSeconds === 'number'
            ? { retryAfterSeconds }
            : {}),
        }
      )
    }

    let responsePayload: unknown
    try {
      responsePayload = JSON.parse(responseText)
    } catch (error) {
      throw new CodeApiClientError(
        'response',
        'CodeAPI response is not valid JSON',
        { cause: error }
      )
    }

    const parsed = parseExecuteResponse(responsePayload)
    const expectedIds = new Set(invocations.map(({ id }) => id))
    if (
      parsed.outcomes.length !== invocations.length ||
      parsed.outcomes.some(({ id }) => !expectedIds.has(id))
    ) {
      throw new CodeApiClientError(
        'runner',
        'CodeAPI outcomes do not match the requested invocations'
      )
    }
    return {
      visibility,
      sessionId: parsed.sessionId,
      outcomes: parsed.outcomes,
    }
  }

  return {
    async executeBatches(
      input: CodeApiBatchExecutionInput
    ): Promise<CodeApiBatchExecutionResult> {
      const result: CodeApiBatchExecutionResult = {}
      if (input.publicInvocations?.length) {
        result.public = await executeBatch(
          'public',
          input,
          input.publicInvocations
        )
      }
      if (input.hiddenInvocations?.length) {
        result.hidden = await executeBatch(
          'hidden',
          input,
          input.hiddenInvocations
        )
      }
      if (!result.public && !result.hidden) {
        throw new CodeApiClientError(
          'request',
          'At least one CODE invocation batch is required'
        )
      }
      if (
        result.public &&
        result.hidden &&
        result.public.sessionId === result.hidden.sessionId
      ) {
        throw new CodeApiClientError(
          'session_reuse',
          'Public and hidden CODE batches reused a sandbox session'
        )
      }
      return result
    },
  }
}

export function gradeCodeInvocationOutcomes(
  tests: CodeTestCase[],
  outcomes: CodeApiInvocationOutcome[]
): CodeSubmissionResult {
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.id, outcome]))
  if (
    outcomeById.size !== outcomes.length ||
    tests.length !== outcomes.length ||
    tests.some((test) => !outcomeById.has(test.id))
  ) {
    throw new CodeApiClientError(
      'runner',
      'CodeAPI outcomes do not match the configured tests'
    )
  }

  let passedWeight = 0
  let totalWeight = 0
  const publicTestResults: CodeSubmissionResult['publicTestResults'] = []
  const hiddenTestResults: CodeSubmissionResult['hiddenTestResults'] = []

  for (const test of tests) {
    const outcome = outcomeById.get(test.id)!
    const passed =
      outcome.status === 'ok' &&
      isDeepStrictEqual(outcome.actualOutput, test.expectedOutput)
    totalWeight += test.weight
    if (passed) passedWeight += test.weight

    if (test.visibility === 'public') {
      publicTestResults.push({
        id: test.id,
        name: test.name,
        passed,
        ...(outcome.status === 'ok'
          ? { actualOutput: outcome.actualOutput }
          : {}),
        stdout: outcome.stdout,
        stderr: outcome.stderr,
      })
    } else {
      hiddenTestResults.push({ id: test.id, passed })
    }
  }

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new CodeApiClientError('runner', 'CODE test weights are invalid')
  }

  return {
    pointsPercentage: passedWeight / totalWeight,
    publicTestResults,
    hiddenTestResults,
  }
}
