import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { isIP } from 'node:net'
import { prisma } from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  CONTROL_NATIVE_CALLBACK,
  CONTROL_NATIVE_CLIENT,
  CONTROL_NATIVE_NAMESPACE,
  CONTROL_NATIVE_ORIGINS,
  type ControlNativeSource,
  controlNativePrincipal,
  type JWTPayload,
  signControlNativeToken,
} from '@klicker-uzh/util'
import { SESSION_MAX_AGE_SECONDS } from '@klicker-uzh/util/client-auth'
import Redis from 'ioredis'
import ipaddr from 'ipaddr.js'
import type { NextApiRequest, NextApiResponse } from 'next'
import { MANAGER_COOKIE_NAME } from './constants'
import { decode } from './jwt'

const ATTEMPT_MS = 5 * 60 * 1000
const CODE_MS = 60 * 1000
const RANDOM = /^[A-Za-z0-9_-]{43}$/
export const nativeHash = (value: string) =>
  createHash('sha256').update(value).digest('hex')
const random = () => randomBytes(32).toString('base64url')
const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const txKey = (id: string) => `${CONTROL_NATIVE_NAMESPACE}:attempt:${id}`

export function nativeLoginBinding(
  callbackUrl: string,
  cookies: Record<string, string | undefined>,
  subject: string
) {
  try {
    const url = new URL(callbackUrl)
    const transaction = url.searchParams.get('transaction') ?? ''
    const browser = cookies[`__Host-control-native-${transaction}`] ?? ''
    if (
      url.origin !== new URL(process.env.APP_ORIGIN_AUTH ?? '').origin ||
      !['/native/complete', '/de/native/complete'].includes(url.pathname) ||
      url.username ||
      url.password ||
      url.hash ||
      [...url.searchParams].length !== 1 ||
      !RANDOM.test(transaction) ||
      !RANDOM.test(browser) ||
      !subject ||
      !process.env.APP_SECRET
    )
      return undefined
    return createHmac('sha256', process.env.APP_SECRET)
      .update(`control-native-fresh:v1\0${transaction}\0${browser}\0${subject}`)
      .digest('hex')
  } catch {
    return undefined
  }
}

interface Attempt {
  state: string
  challenge: string
  cancelDigest: string
  deadline: number
  status: 'created' | 'bound' | 'approved' | 'exchanged' | 'cancelled'
  browserDigest?: string
  codeDigest?: string
  codeDeadline?: number
  principal?: {
    sub: string
    scope: 'SESSION_EXEC' | 'READ_ONLY'
    source: ControlNativeSource
  }
}

export class NativeAuthError extends Error {
  constructor(public status = 400) {
    super('native_auth_failed')
  }
}

// Only explicitly trusted connection peers may supply a client-address chain.
export function nativeClientAddress(req: NextApiRequest): string {
  const address = (raw: string | undefined, status: number) => {
    if (!raw || raw.includes('%') || !isIP(raw))
      throw new NativeAuthError(status)
    return ipaddr.process(raw)
  }
  const configured = process.env.CONTROL_NATIVE_TRUSTED_PROXY_CIDRS ?? ''
  if (Buffer.byteLength(configured) > 8192) throw new NativeAuthError(503)
  const entries = configured.trim() ? configured.split(',') : []
  if (entries.length > 64) throw new NativeAuthError(503)
  const ranges = entries.map((entry): [ipaddr.IPv4 | ipaddr.IPv6, number] => {
    const [raw, prefix, extra] = entry.trim().split('/')
    address(raw, 503)
    if (!prefix || !/^(0|[1-9]\d{0,2})$/.test(prefix) || extra !== undefined)
      throw new NativeAuthError(503)
    let range = ipaddr.parse(raw!)
    let bits = Number(prefix)
    if (bits > (range.kind() === 'ipv4' ? 32 : 128))
      throw new NativeAuthError(503)
    if (range instanceof ipaddr.IPv6 && range.isIPv4MappedAddress()) {
      if (bits < 96) throw new NativeAuthError(503)
      range = range.toIPv4Address()
      bits -= 96
    }
    if (bits === 0) throw new NativeAuthError(503)
    return [range, bits]
  })
  const trusted = (candidate: ipaddr.IPv4 | ipaddr.IPv6) =>
    ranges.some(
      ([range, bits]) =>
        candidate.kind() === range.kind() && candidate.match(range, bits)
    )
  let current = address(req.socket?.remoteAddress, 503)
  if (!trusted(current)) return current.toString()
  const forwarded = req.headers['x-forwarded-for']
  const occurrences = (req.rawHeaders ?? []).filter(
    (value, index) =>
      index % 2 === 0 && value.toLowerCase() === 'x-forwarded-for'
  ).length
  if (
    typeof forwarded !== 'string' ||
    occurrences !== 1 ||
    Buffer.byteLength(forwarded) > 4096
  )
    throw new NativeAuthError()
  const chain = forwarded.split(',').map((value) => value.trim())
  if (chain.length > 32 || chain.some((value) => !value))
    throw new NativeAuthError()
  for (let i = chain.length - 1; i >= 0; i--) {
    current = address(chain[i], 400)
    if (!trusted(current)) return current.toString()
  }
  throw new NativeAuthError()
}

export class NativeHandoff {
  constructor(
    readonly redis: Redis,
    readonly database: PrismaClient,
    readonly secret: string,
    readonly authOrigin: string,
    readonly now = () => Date.now()
  ) {}

  async read(id: string): Promise<{ raw: string; attempt: Attempt }> {
    if (!RANDOM.test(id)) throw new NativeAuthError()
    const raw = await this.redis.get(txKey(id))
    if (!raw) throw new NativeAuthError()
    const attempt = JSON.parse(raw) as Attempt
    if (attempt.deadline <= this.now() || attempt.status === 'cancelled')
      throw new NativeAuthError()
    return { raw, attempt }
  }

  async start(body: Record<string, unknown>, address: string) {
    if (
      body.client_id !== CONTROL_NATIVE_CLIENT ||
      typeof body.state !== 'string' ||
      !RANDOM.test(body.state) ||
      typeof body.challenge !== 'string' ||
      !RANDOM.test(body.challenge) ||
      typeof body.cancel_digest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.cancel_digest)
    ) {
      throw new NativeAuthError()
    }
    const id = random()
    const attempt: Attempt = {
      state: body.state,
      challenge: body.challenge,
      cancelDigest: body.cancel_digest,
      deadline: this.now() + ATTEMPT_MS,
      status: 'created',
    }
    const addressDigest = createHmac('sha256', this.secret)
      .update(address)
      .digest('hex')
    const created = await this.redis.eval(
      `
      local n = redis.call('INCR', KEYS[2])
      if n == 1 then redis.call('PEXPIRE', KEYS[2], ARGV[3]) end
      if n > 20 then return 0 end
      redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[4])
      if redis.call('ZCARD', KEYS[3]) >= 1000 then return 0 end
      if not redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3], 'NX') then return 0 end
      redis.call('ZADD', KEYS[3], ARGV[2], KEYS[1])
      redis.call('PEXPIRE', KEYS[3], ARGV[3])
      return 1`,
      3,
      txKey(id),
      `${CONTROL_NATIVE_NAMESPACE}:rate:${addressDigest}`,
      `${CONTROL_NATIVE_NAMESPACE}:active`,
      JSON.stringify(attempt),
      attempt.deadline,
      ATTEMPT_MS,
      this.now()
    )
    if (created !== 1) throw new NativeAuthError(429)
    return {
      transaction: id,
      authorization_url: `${this.authOrigin}/native/complete?transaction=${id}`,
    }
  }

  async replace(id: string, raw: string, attempt: Attempt) {
    const ok = await this.redis.eval(
      `
      if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
      redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
      return 1`,
      1,
      txKey(id),
      raw,
      JSON.stringify(attempt)
    )
    if (ok !== 1) throw new NativeAuthError()
  }

  async bind(id: string, browser: string) {
    if (!RANDOM.test(browser)) throw new NativeAuthError()
    const { raw, attempt } = await this.read(id)
    if (attempt.status !== 'created' && attempt.status !== 'bound')
      throw new NativeAuthError()
    const digest = nativeHash(browser)
    if (attempt.browserDigest && !equal(attempt.browserDigest, digest))
      throw new NativeAuthError()
    if (!attempt.browserDigest) {
      await this.replace(id, raw, {
        ...attempt,
        status: 'bound',
        browserDigest: digest,
      })
    }
  }

  csrf(id: string, browser: string, subject: string) {
    return createHmac('sha256', this.secret)
      .update(`control-native-csrf:v2\0${id}\0${browser}\0${subject}`)
      .digest('hex')
  }

  async principal(evidence: JWTPayload | null) {
    const principal = await controlNativePrincipal(
      this.database,
      this.secret,
      evidence
    )
    if (!principal) throw new NativeAuthError(401)
    return {
      sub: principal.sub,
      source: principal.source,
      scope: principal.scope,
    }
  }

  async approve(
    id: string,
    browser: string,
    csrf: string,
    evidence: JWTPayload | null
  ) {
    const { raw, attempt } = await this.read(id)
    if (
      attempt.status !== 'bound' ||
      !attempt.browserDigest ||
      !equal(attempt.browserDigest, nativeHash(browser))
    )
      throw new NativeAuthError()
    const principal = await this.principal(evidence)
    if (!equal(this.csrf(id, browser, principal.sub), csrf))
      throw new NativeAuthError()
    const code = random()
    await this.replace(id, raw, {
      ...attempt,
      status: 'approved',
      principal,
      codeDigest: nativeHash(code),
      codeDeadline: Math.min(attempt.deadline, this.now() + CODE_MS),
    })
    const callback = new URL(CONTROL_NATIVE_CALLBACK)
    callback.searchParams.set('code', code)
    callback.searchParams.set('state', attempt.state)
    return callback.href
  }

  async exchange(body: Record<string, unknown>) {
    if (
      body.client_id !== CONTROL_NATIVE_CLIENT ||
      typeof body.transaction !== 'string' ||
      typeof body.code !== 'string' ||
      !RANDOM.test(body.code) ||
      typeof body.verifier !== 'string' ||
      !RANDOM.test(body.verifier) ||
      typeof body.state !== 'string' ||
      !RANDOM.test(body.state)
    )
      throw new NativeAuthError()
    const { raw, attempt } = await this.read(body.transaction)
    const challenge = createHash('sha256')
      .update(body.verifier)
      .digest('base64url')
    if (
      attempt.status !== 'approved' ||
      !attempt.principal ||
      !attempt.codeDeadline ||
      attempt.codeDeadline <= this.now() ||
      !equal(attempt.state, body.state) ||
      !equal(attempt.challenge, challenge) ||
      !attempt.codeDigest ||
      !equal(attempt.codeDigest, nativeHash(body.code))
    )
      throw new NativeAuthError()
    const principal = await this.principal({
      ...attempt.principal,
      role: 'USER',
      controlNativeSource: attempt.principal.source,
    })
    const issuedAt = this.now()
    const credential = await signControlNativeToken(
      principal,
      this.secret,
      this.authOrigin,
      issuedAt
    )
    const tombstone = { ...attempt, status: 'exchanged' }
    delete tombstone.codeDigest
    delete tombstone.principal
    const ok = await this.redis.eval(
      `
      if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
      local t = cjson.decode(ARGV[1])
      if t.deadline <= tonumber(ARGV[3]) or t.codeDeadline <= tonumber(ARGV[3]) then return 0 end
      redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
      return 1`,
      1,
      txKey(body.transaction),
      raw,
      JSON.stringify(tombstone),
      issuedAt
    )
    if (ok !== 1) throw new NativeAuthError()
    return credential
  }

  async cancel(body: Record<string, unknown>) {
    if (
      body.client_id !== CONTROL_NATIVE_CLIENT ||
      typeof body.transaction !== 'string' ||
      typeof body.cancel_secret !== 'string' ||
      !RANDOM.test(body.cancel_secret)
    )
      throw new NativeAuthError()
    const digest = nativeHash(body.cancel_secret)
    const ok = await this.redis.eval(
      `
      local raw = redis.call('GET', KEYS[1])
      if not raw then return 1 end
      local t = cjson.decode(raw)
      if t.cancelDigest ~= ARGV[1] then return 0 end
      t.status = 'cancelled'; t.codeDigest = nil; t.principal = nil
      redis.call('SET', KEYS[1], cjson.encode(t), 'KEEPTTL')
      return 1`,
      1,
      txKey(body.transaction),
      digest
    )
    if (ok !== 1) throw new NativeAuthError()
  }
}

let service: Promise<NativeHandoff> | undefined
export async function nativeHandoff() {
  if (!service) {
    const secret = process.env.APP_SECRET
    const origin = new URL(process.env.APP_ORIGIN_AUTH ?? '')
    if (
      !secret ||
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password
    )
      throw new NativeAuthError(503)
    service = (async () => {
      const redis = new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASS || undefined,
        tls: process.env.REDIS_TLS ? {} : undefined,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        commandTimeout: 3000,
      })
      redis.on('error', () => {})
      try {
        await redis.connect()
        return new NativeHandoff(redis, prisma, secret, origin.origin)
      } catch (error) {
        redis.disconnect()
        throw error
      }
    })().catch((error: unknown) => {
      service = undefined
      throw error
    })
  }
  return service
}

export async function nativeBrowserEvidence(
  req: Pick<NextApiRequest, 'cookies'>
) {
  const chunks = Object.entries(req.cookies)
    .filter(
      ([name]) =>
        name === MANAGER_COOKIE_NAME ||
        new RegExp(
          `^${MANAGER_COOKIE_NAME.replaceAll('.', '\\.')}\\.\\d+$`
        ).test(name)
    )
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  const token = chunks.map(([, value]) => value).join('')
  if (!token) return null
  try {
    const evidence = await decode({
      token,
      secret: process.env.APP_SECRET ?? '',
    })
    const now = Math.floor(Date.now() / 1000)
    if (
      !evidence ||
      typeof evidence.iat !== 'number' ||
      evidence.iat > now + 60 ||
      now - evidence.iat > SESSION_MAX_AGE_SECONDS
    )
      return null
    return evidence as JWTPayload
  } catch {
    return null
  }
}

export async function nativeEndpoint(
  req: NextApiRequest,
  res: NextApiResponse,
  action: 'start' | 'exchange' | 'cancel'
) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Vary', 'Origin')
  const origin = req.headers.origin
  if (!CONTROL_NATIVE_ORIGINS.some((allowed) => allowed === origin)) {
    res.status(403).end()
    return
  }
  res.setHeader('Access-Control-Allow-Origin', origin!)
  if (req.method === 'OPTIONS') {
    const headers = String(req.headers['access-control-request-headers'] ?? '')
      .toLowerCase()
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    if (
      req.headers['access-control-request-method'] !== 'POST' ||
      headers.some(
        (header) => !['content-type', 'authorization'].includes(header)
      )
    ) {
      res.status(403).end()
      return
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    res.status(405).end()
    return
  }
  if (
    !req.headers['content-type']?.startsWith('application/json') ||
    !req.body ||
    Array.isArray(req.body) ||
    typeof req.body !== 'object'
  ) {
    res.status(400).end()
    return
  }
  try {
    const address = action === 'start' ? nativeClientAddress(req) : undefined
    const api = await nativeHandoff()
    if (action === 'start')
      res.status(200).json(await api.start(req.body, address!))
    else if (action === 'exchange')
      res.status(200).json(await api.exchange(req.body))
    else {
      await api.cancel(req.body)
      res.status(204).end()
    }
  } catch (error) {
    res
      .status(error instanceof NativeAuthError ? error.status : 503)
      .json({ error: 'native_auth_failed' })
  }
}
