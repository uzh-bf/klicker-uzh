import type { APIRequestContext, BrowserContext, Page } from '@playwright/test'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { jwtVerify, SignJWT } from 'jose'
import { URL_AUTH, URL_STUDENT } from './constants.js'

const ACTIVATION_TEMPLATE = 'ParticipantAccountActivation'
const MINIMAL_ACTIVATION_TEMPLATE = '<a href="[LINK]">Activate</a>'

type RecordValue = Record<string, unknown>

function asRecord(value: unknown): RecordValue | null {
  return typeof value === 'object' && value !== null
    ? (value as RecordValue)
    : null
}

function getCaseInsensitive(record: RecordValue, key: string) {
  const exact = record[key]
  if (exact !== undefined) return exact

  const expected = key.toLowerCase()
  const matchingKey = Object.keys(record).find(
    (candidate) => candidate.toLowerCase() === expected
  )
  return matchingKey ? record[matchingKey] : undefined
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value)
    throw new Error(`Missing required production test environment: ${name}`)
  return value
}

export function assertProductionExecution() {
  if (process.env.KLICKER_PLAYWRIGHT_PRODUCTION !== '1') {
    throw new Error(
      'KLICKER_PLAYWRIGHT_PRODUCTION=1 is required for account production specs'
    )
  }
}

export function getPwaUrl(pathname = '/') {
  const base =
    process.env.URL_STUDENT ?? process.env.PLAYWRIGHT_BASE_URL ?? URL_STUDENT
  return new URL(pathname, base).toString()
}

export async function signSyntheticLtiToken({
  sub,
  email,
  expiresAt,
}: {
  sub: string
  email: string
  expiresAt?: number
}) {
  const builder = new SignJWT({
    sub,
    email,
    scope: 'LTI1.3',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(requiredEnv('APP_ORIGIN_AUTH'))

  if (typeof expiresAt === 'number') {
    builder.setExpirationTime(expiresAt)
  } else {
    builder.setExpirationTime('5m')
  }

  return builder.sign(Buffer.from(requiredEnv('APP_SECRET'), 'utf8'))
}

export function tamperJwtSignature(token: string) {
  const parts = token.split('.')
  const signature = parts[2]
  if (!signature)
    throw new Error('Cannot tamper with a JWT without a signature')
  const signatureBytes = Buffer.from(signature, 'base64url')
  if (signatureBytes.length === 0) {
    throw new Error('Cannot tamper with an empty JWT signature')
  }
  signatureBytes[0] ^= 0xff
  parts[2] = signatureBytes.toString('base64url')
  return parts.join('.')
}

export async function setSyntheticLtiCookie(
  context: BrowserContext,
  token: string
) {
  const pwa = new URL(getPwaUrl())
  await context.addCookies([
    {
      name: 'lti-token',
      value: token,
      url: pwa.origin,
      httpOnly: true,
      secure: pwa.protocol === 'https:',
      sameSite: 'Lax',
    },
  ])
}

export async function suppressCookieHeaders(page: Page) {
  const origins = new Set([
    new URL(getPwaUrl()).origin,
    new URL(requiredEnv('APP_ORIGIN_API')).origin,
    new URL(process.env.APP_ORIGIN_AUTH ?? process.env.URL_AUTH ?? URL_AUTH)
      .origin,
  ])
  const observation = {
    incomingCookieRequests: 0,
    relayedCookieFreeRequests: 0,
    cookieHeadersOnWire: 0,
    wireRequests: 0,
    interceptionFailures: 0,
  }
  // Chromium pauses every redirect hop, unlike Playwright route interception.
  // The session is owned by this page and closes with its isolated context.
  const session = await page.context().newCDPSession(page)
  const requests = new Set<string>()
  session.on('Fetch.requestPaused', async (event) => {
    if (event.networkId) requests.add(event.networkId)
    const headers = Object.entries(event.request.headers)
      .filter(([name]) => name.toLowerCase() !== 'cookie')
      .map(([name, value]) => ({ name, value: String(value) }))
    headers.push({ name: 'Cookie', value: '' })
    try {
      await session.send('Fetch.continueRequest', {
        requestId: event.requestId,
        headers,
      })
      observation.relayedCookieFreeRequests += 1
    } catch {
      if (!page.isClosed()) observation.interceptionFailures += 1
    }
  })
  session.on('Network.requestWillBeSentExtraInfo', (event) => {
    if (!requests.has(event.requestId)) return
    observation.wireRequests += 1
    if (event.associatedCookies.length > 0)
      observation.incomingCookieRequests += 1
    if (
      Object.entries(event.headers).some(
        ([name, value]) => name.toLowerCase() === 'cookie' && value
      )
    ) {
      observation.cookieHeadersOnWire += 1
    }
  })
  await session.send('Network.enable')
  await session.send('Fetch.enable', {
    patterns: [...origins].map((origin) => ({
      urlPattern: `${origin}/*`,
      requestStage: 'Request' as const,
    })),
  })
  return observation
}

export async function hasVerifiedParticipantCookie(
  context: BrowserContext,
  participantId: string
) {
  const cookie = (await context.cookies()).find(
    ({ name }) => name === 'participant_token'
  )
  if (!cookie) return false

  const { payload } = await jwtVerify(
    cookie.value,
    Buffer.from(requiredEnv('APP_SECRET'), 'utf8'),
    { algorithms: ['HS256'] }
  )

  return payload.sub === participantId && payload.role === 'PARTICIPANT'
}

function valuesFromAddressField(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(valuesFromAddressField)

  const record = asRecord(value)
  if (!record) return []

  const address = getCaseInsensitive(record, 'address')
  if (typeof address === 'string') return [address]

  const mailbox = getCaseInsensitive(record, 'mailbox')
  const domain =
    getCaseInsensitive(record, 'domain') ?? getCaseInsensitive(record, 'host')
  if (typeof mailbox === 'string' && typeof domain === 'string') {
    return [`${mailbox}@${domain}`]
  }

  return []
}

function extractEmailAddresses(value: string) {
  return (
    value.match(
      /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*/gi
    ) ?? []
  ).map((address) => address.toLowerCase())
}

function messageRecipients(message: unknown) {
  const root = asRecord(message)
  if (!root) return []

  const content = asRecord(
    getCaseInsensitive(root, 'Content') ?? getCaseInsensitive(root, 'content')
  )
  const headers = content
    ? asRecord(
        getCaseInsensitive(content, 'Headers') ??
          getCaseInsensitive(content, 'headers')
      )
    : null
  const headerTo = headers ? getCaseInsensitive(headers, 'To') : undefined
  const rootTo = getCaseInsensitive(root, 'To')

  return [
    ...valuesFromAddressField(headerTo),
    ...valuesFromAddressField(rootTo),
  ]
    .flatMap(extractEmailAddresses)
    .map((address) => address.toLowerCase())
}

function messageBody(message: unknown): string | null {
  const root = asRecord(message)
  if (!root) return null
  const content = asRecord(
    getCaseInsensitive(root, 'Content') ?? getCaseInsensitive(root, 'content')
  )
  const body = content
    ? (getCaseInsensitive(content, 'Body') ??
      getCaseInsensitive(content, 'body'))
    : (getCaseInsensitive(root, 'Body') ?? getCaseInsensitive(root, 'body'))
  const mime = asRecord(getCaseInsensitive(root, 'MIME'))
  const parts = mime ? getCaseInsensitive(mime, 'Parts') : undefined
  if (Array.isArray(parts)) {
    return parts.map(messageBody).filter(Boolean).join('\n')
  }
  if (typeof body !== 'string') return null
  const headers = asRecord(getCaseInsensitive(content ?? root, 'Headers'))
  const encoding = headers
    ? getCaseInsensitive(headers, 'Content-Transfer-Encoding')
    : undefined
  if (String(encoding).toLowerCase() === 'quoted-printable') {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([\da-f]{2})/gi, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      )
  }
  return body
}

function localActivationLink(body: string) {
  const candidates = new Set<string>()
  for (const match of body.matchAll(/href=["']([^"']+)["']/gi)) {
    if (match[1]) candidates.add(match[1])
  }
  for (const match of body.matchAll(
    /https?:\/\/[^\s<>"']+\/activation\?token=[^\s<>"']+/gi
  )) {
    if (match[0]) candidates.add(match[0].replace(/[).,]+$/, ''))
  }

  const expectedOrigin = new URL(getPwaUrl()).origin
  for (const candidate of candidates) {
    try {
      const link = new URL(candidate, expectedOrigin)
      if (
        link.origin === expectedOrigin &&
        link.pathname.endsWith('/activation') &&
        link.searchParams.has('token')
      ) {
        return link.toString()
      }
    } catch {
      // Ignore malformed links in unrelated message content.
    }
  }

  return null
}

export async function findActivationLink(
  request: APIRequestContext,
  recipient: string
) {
  const searchUrl = new URL('/api/v2/search', requiredEnv('URL_MAILHOG'))
  searchUrl.searchParams.set('kind', 'to')
  searchUrl.searchParams.set('query', recipient)
  searchUrl.searchParams.set('start', '0')
  searchUrl.searchParams.set('limit', '10')

  const response = await request.get(searchUrl.toString())
  if (!response.ok()) {
    throw new Error(`MailHog search failed with status ${response.status()}`)
  }

  const result = asRecord(await response.json())
  const items = result ? getCaseInsensitive(result, 'items') : undefined
  if (!Array.isArray(items)) return null

  const normalizedRecipient = recipient.toLowerCase()
  for (const item of items) {
    // Check the complete recipient envelope before inspecting its body.
    if (!messageRecipients(item).includes(normalizedRecipient)) continue
    const body = messageBody(item)
    if (!body) continue
    const link = localActivationLink(body)
    if (link) return link
  }

  return null
}

export async function installMinimalActivationTemplate(prisma: PrismaClient) {
  const previous = await prisma.emailTemplate.findUnique({
    where: { name: ACTIVATION_TEMPLATE },
  })

  await prisma.emailTemplate.upsert({
    where: { name: ACTIVATION_TEMPLATE },
    update: { html: MINIMAL_ACTIVATION_TEMPLATE },
    create: {
      name: ACTIVATION_TEMPLATE,
      html: MINIMAL_ACTIVATION_TEMPLATE,
    },
  })

  return async () => {
    if (previous) {
      await prisma.emailTemplate.update({
        where: { name: ACTIVATION_TEMPLATE },
        data: { html: previous.html },
      })
    } else {
      await prisma.emailTemplate.deleteMany({
        where: { name: ACTIVATION_TEMPLATE },
      })
    }
  }
}

export async function deleteSyntheticParticipant(
  prisma: PrismaClient,
  expected: { id: string; email: string; username: string }
) {
  const participant = await prisma.participant.findUnique({
    where: { id: expected.id },
    select: { email: true, username: true },
  })
  if (!participant) return

  if (
    participant.email !== expected.email ||
    participant.username !== expected.username
  ) {
    throw new Error(
      `Refusing cleanup for changed synthetic participant ${expected.id}`
    )
  }

  await prisma.participantAccount.deleteMany({
    where: { participantId: expected.id },
  })
  await prisma.participant.delete({ where: { id: expected.id } })
}
