import type {
  CodeSubmissionResult,
  CodeTestCase,
  JsonValue,
} from '@klicker-uzh/types'
import {
  CODE_TEST_MAX_COUNT,
  CODE_TEST_TIMEOUT_SECONDS,
  isCodeJsonValue,
  isValidPythonEntrypoint,
} from '@klicker-uzh/types'
import { importPKCS8, SignJWT } from 'jose'
import { createHash, randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

const CODEAPI_PRINCIPAL_SOURCE = 'klicker_jwt'
const MAX_TOKEN_TTL_SECONDS = 300
const MAX_RESPONSE_BYTES = 3 * 1_024 * 1_024
const MAX_RUNNER_OUTPUT_CHARS = 4_096
const MAX_EXCEPTION_CHARS = 2_048

const CHILD_RUNNER = String.raw`
import contextlib
import io
import json
import sys
import traceback

MAX_TEXT_CHARS = ${MAX_RUNNER_OUTPUT_CHARS}
MAX_EXCEPTION_CHARS = ${MAX_EXCEPTION_CHARS}


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

interface CodeApiInvocation {
  id: string
  args: JsonValue[]
}

interface CodeApiExecutionRequestInput {
  studentCode: string
  entrypoint: string
  invocations: CodeApiInvocation[]
  perTestTimeoutSeconds: number
}

export interface CodeApiExecutionRequest {
  lang: 'python'
  code: string
}

type CodeApiInvocationOutcome =
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

interface CodeApiBatchResult {
  sessionId: string
  outcomes: CodeApiInvocationOutcome[]
}

export interface CodeApiSubmissionInput {
  subject: string
  role?: string
  studentCode: string
  entrypoint: string
  tests: CodeTestCase[]
  perTestTimeoutSeconds: number
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

type CodeApiPrivateKey = Awaited<ReturnType<typeof importPKCS8>>

async function importCodeApiPrivateKey(
  config: CodeApiClientConfig
): Promise<CodeApiPrivateKey> {
  try {
    return await importPKCS8(config.privateKeyPem, config.algorithm)
  } catch (error) {
    throw new CodeApiClientError(
      'config',
      'CodeAPI JWT private key is invalid',
      { cause: error }
    )
  }
}

async function signCodeApiJwt(
  config: CodeApiClientConfig,
  privateKey: CodeApiPrivateKey,
  claims: {
    subject: string
    role?: string
  },
  options: {
    nowSeconds?: number
    jti?: string
  } = {}
): Promise<string> {
  const subject = requireString(claims.subject, 'CodeAPI JWT subject', 256)
  const role = claims.role
    ? requireString(claims.role, 'CodeAPI JWT role', 128)
    : undefined
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1_000)
  const jti = requireString(options.jti ?? randomUUID(), 'CodeAPI JWT id', 256)

  if (!Number.isInteger(nowSeconds) || nowSeconds < 0) {
    throw new CodeApiClientError('config', 'CodeAPI JWT time is invalid')
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
  return signCodeApiJwt(
    config,
    await importCodeApiPrivateKey(config),
    claims,
    options
  )
}

function assertJsonValue(
  value: unknown,
  label: string,
  kind: CodeApiClientErrorKind
): asserts value is JsonValue {
  if (!isCodeJsonValue(value)) {
    throw new CodeApiClientError(kind, `${label} exceeds the CODE JSON limits`)
  }
}

function validateInvocationId(
  value: unknown,
  label: string,
  kind: CodeApiClientErrorKind = 'response'
): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new CodeApiClientError(kind, `${label} is invalid`)
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
  if (!isValidPythonEntrypoint(input.entrypoint)) {
    throw new CodeApiClientError('request', 'CODE entrypoint is invalid')
  }
  if (
    !Number.isInteger(input.perTestTimeoutSeconds) ||
    input.perTestTimeoutSeconds < 1 ||
    input.perTestTimeoutSeconds > CODE_TEST_TIMEOUT_SECONDS
  ) {
    throw new CodeApiClientError(
      'request',
      `Per-test timeout must be between 1 and ${CODE_TEST_TIMEOUT_SECONDS} seconds`
    )
  }
  if (
    !Array.isArray(input.invocations) ||
    input.invocations.length === 0 ||
    input.invocations.length > CODE_TEST_MAX_COUNT
  ) {
    throw new CodeApiClientError(
      'request',
      `A CODE batch must contain between 1 and ${CODE_TEST_MAX_COUNT} invocations`
    )
  }

  const ids = new Set<string>()
  for (const invocation of input.invocations) {
    const id = validateInvocationId(invocation.id, 'Invocation id', 'request')
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
    assertJsonValue(invocation.args, 'CODE invocation arguments', 'request')
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
import os
import selectors
import signal
import subprocess
import sys
import time

PER_TEST_TIMEOUT_SECONDS = ${input.perTestTimeoutSeconds}
MAX_CHILD_PIPE_BYTES = 64 * 1024
PAYLOAD = json.loads(base64.b64decode("${encodedPayload}").decode("utf-8"))
CHILD_RUNNER = base64.b64decode("${encodedChildRunner}").decode("utf-8")


def capped(value, limit):
    return value[:limit] if isinstance(value, str) else ""


def kill_process_group(process):
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except PermissionError:
        process.kill()
    try:
        process.wait(timeout=1)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def run_invocation(invocation):
    child_payload = {
        "studentCode": PAYLOAD["studentCode"],
        "entrypoint": PAYLOAD["entrypoint"],
        "args": invocation["args"],
    }
    try:
        process = subprocess.Popen(
            [sys.executable, "-I", "-c", CHILD_RUNNER],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
    except OSError:
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": "",
            "exception": "child_process_failed",
        }

    try:
        process.stdin.write(
            json.dumps(child_payload, ensure_ascii=False).encode("utf-8")
        )
        process.stdin.close()
    except (BrokenPipeError, OSError):
        kill_process_group(process)
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": "",
            "exception": "child_process_failed",
        }

    streams = selectors.DefaultSelector()
    streams.register(process.stdout, selectors.EVENT_READ, "stdout")
    streams.register(process.stderr, selectors.EVENT_READ, "stderr")
    output = {"stdout": bytearray(), "stderr": bytearray()}
    total_bytes = 0
    deadline = time.monotonic() + PER_TEST_TIMEOUT_SECONDS
    failure = None

    while streams.get_map():
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            failure = "timeout"
            break

        for key, _ in streams.select(timeout=min(remaining, 0.05)):
            chunk = os.read(key.fileobj.fileno(), 8192)
            if not chunk:
                streams.unregister(key.fileobj)
                continue
            total_bytes += len(chunk)
            if total_bytes > MAX_CHILD_PIPE_BYTES:
                failure = "output_limit"
                break
            output[key.data].extend(chunk)
        if failure:
            break

    if failure:
        streams.close()
        kill_process_group(process)
        if failure == "timeout":
            return {
                "id": invocation["id"],
                "status": "timeout",
                "stdout": "",
                "stderr": "",
            }
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": output["stderr"]
                .decode("utf-8", errors="replace")[:${MAX_RUNNER_OUTPUT_CHARS}],
            "exception": "output_limit_exceeded",
        }

    streams.close()
    try:
        return_code = process.wait(timeout=max(0.01, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        kill_process_group(process)
        return {
            "id": invocation["id"],
            "status": "timeout",
            "stdout": "",
            "stderr": "",
        }

    try:
        child_stdout = output["stdout"].decode("utf-8")
        child_stderr = output["stderr"].decode("utf-8")
    except UnicodeDecodeError:
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": "",
            "exception": "invalid_child_encoding",
        }

    if return_code != 0:
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": capped(child_stderr, ${MAX_RUNNER_OUTPUT_CHARS}),
            "exception": "child_process_failed",
        }

    try:
        child_result = json.loads(child_stdout)
    except (TypeError, ValueError):
        return {
            "id": invocation["id"],
            "status": "error",
            "stdout": "",
            "stderr": capped(child_stderr, ${MAX_RUNNER_OUTPUT_CHARS}),
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

function asRecord(
  value: unknown,
  label: string,
  kind: CodeApiClientErrorKind = 'response'
): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new CodeApiClientError(kind, `${label} is invalid`)
  }
  return value as Record<string, unknown>
}

function assertOnlyKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  kind: CodeApiClientErrorKind = 'response'
): void {
  const allowedKeys = new Set(allowed)
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    throw new CodeApiClientError(kind, `${label} contains unsupported fields`)
  }
}

function cappedString(
  value: unknown,
  label: string,
  maxLength: number,
  kind: CodeApiClientErrorKind = 'response'
): string {
  if (typeof value !== 'string') {
    throw new CodeApiClientError(kind, `${label} is invalid`)
  }
  return value.slice(0, maxLength)
}

function parseCodeApiRunnerOutput(stdout: string): CodeApiInvocationOutcome[] {
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

  const envelope = asRecord(parsed, 'CodeAPI runner output', 'runner')
  assertOnlyKeys(
    envelope,
    ['version', 'outcomes'],
    'CodeAPI runner output',
    'runner'
  )
  if (envelope.version !== 1 || !Array.isArray(envelope.outcomes)) {
    throw new CodeApiClientError('runner', 'CodeAPI runner output is invalid')
  }
  if (envelope.outcomes.length > CODE_TEST_MAX_COUNT) {
    throw new CodeApiClientError(
      'runner',
      'CodeAPI runner returned too many outcomes'
    )
  }

  const ids = new Set<string>()
  return envelope.outcomes.map((rawOutcome, index) => {
    const outcome = asRecord(rawOutcome, `CodeAPI outcome ${index}`, 'runner')
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
      MAX_RUNNER_OUTPUT_CHARS,
      'runner'
    )
    const stderrValue = cappedString(
      outcome.stderr,
      `CodeAPI outcome ${index} stderr`,
      MAX_RUNNER_OUTPUT_CHARS,
      'runner'
    )

    if (outcome.status === 'ok') {
      assertOnlyKeys(
        outcome,
        ['id', 'status', 'actualOutput', 'stdout', 'stderr'],
        `CodeAPI outcome ${index}`,
        'runner'
      )
      if (!Object.hasOwn(outcome, 'actualOutput')) {
        throw new CodeApiClientError(
          'runner',
          'Successful CodeAPI outcome has no output'
        )
      }
      assertJsonValue(
        outcome.actualOutput,
        `CodeAPI outcome ${index} actual output`,
        'runner'
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
        `CodeAPI outcome ${index}`,
        'runner'
      )
      const exception =
        typeof outcome.exception === 'undefined'
          ? undefined
          : cappedString(
              outcome.exception,
              `CodeAPI outcome ${index} exception`,
              MAX_EXCEPTION_CHARS,
              'runner'
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
        `CodeAPI outcome ${index}`,
        'runner'
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
  let signingKeyPromise: Promise<CodeApiPrivateKey> | undefined

  async function executeBatch(
    input: CodeApiSubmissionInput,
    invocations: CodeApiInvocation[],
    signal: AbortSignal
  ): Promise<CodeApiBatchResult> {
    signingKeyPromise ??= importCodeApiPrivateKey(config)
    const token = await signCodeApiJwt(
      config,
      await signingKeyPromise,
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
        signal,
      })
      responseText = await readLimitedResponseBody(response)
    } catch (error) {
      if (signal.aborted) {
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
      sessionId: parsed.sessionId,
      outcomes: parsed.outcomes,
    }
  }

  return {
    async executeAndGrade(
      input: CodeApiSubmissionInput
    ): Promise<CodeSubmissionResult> {
      validateCodeApiTests(input.tests)
      const publicInvocations = input.tests
        .filter((test) => test.visibility === 'public')
        .map(({ id, args }) => ({ id, args }))
      const hiddenInvocations = input.tests
        .filter((test) => test.visibility === 'hidden')
        .map(({ id, args }) => ({ id, args }))

      let publicResult: CodeApiBatchResult | undefined
      let hiddenResult: CodeApiBatchResult | undefined
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        config.requestTimeoutMs
      )
      try {
        if (publicInvocations.length > 0) {
          publicResult = await executeBatch(
            input,
            publicInvocations,
            controller.signal
          )
        }
        if (hiddenInvocations.length > 0) {
          hiddenResult = await executeBatch(
            input,
            hiddenInvocations,
            controller.signal
          )
        }
      } finally {
        clearTimeout(timeout)
      }
      if (
        publicResult &&
        hiddenResult &&
        publicResult.sessionId === hiddenResult.sessionId
      ) {
        throw new CodeApiClientError(
          'session_reuse',
          'Public and hidden CODE batches reused a sandbox session'
        )
      }
      return gradeCodeInvocationOutcomes(input.tests, [
        ...(publicResult?.outcomes ?? []),
        ...(hiddenResult?.outcomes ?? []),
      ])
    },
  }
}

function validateCodeApiTests(tests: CodeTestCase[]): void {
  if (
    !Array.isArray(tests) ||
    tests.length === 0 ||
    tests.length > CODE_TEST_MAX_COUNT
  ) {
    throw new CodeApiClientError(
      'request',
      `CODE grading requires between 1 and ${CODE_TEST_MAX_COUNT} tests`
    )
  }

  const ids = new Set<string>()
  for (const test of tests) {
    const id = validateInvocationId(test.id, 'CODE test id', 'request')
    if (ids.has(id)) {
      throw new CodeApiClientError('request', 'CODE test ids must be unique')
    }
    ids.add(id)
    if (
      typeof test.name !== 'string' ||
      test.name.trim().length === 0 ||
      (test.visibility !== 'public' && test.visibility !== 'hidden') ||
      typeof test.weight !== 'number' ||
      !Number.isFinite(test.weight) ||
      test.weight <= 0 ||
      !Array.isArray(test.args)
    ) {
      throw new CodeApiClientError('request', 'CODE test is invalid')
    }
    assertJsonValue(test.args, 'CODE test arguments', 'request')
    assertJsonValue(test.expectedOutput, 'CODE expected output', 'request')
  }
}

function gradeCodeInvocationOutcomes(
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
