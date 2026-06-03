import {
  UserLoginScope,
  UserRole,
  type Locale,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { signJWT, verifyJWT } from '@klicker-uzh/util'
import { TRPCError } from '@trpc/server'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'

type CookieResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown
}

const COOKIE_SETTINGS = {
  domain: process.env.COOKIE_DOMAIN,
  path: '/',
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24 * 30,
  secure:
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1',
  sameSite: 'lax',
}

let transport: nodemailer.Transporter | undefined

const rateLimitStore: Record<string, { count: number; lastRequest: number }> =
  {}
const RATE_LIMIT = 5
const TIME_WINDOW = 60 * 60 * 1000

function getCookieResponse(res: unknown): CookieResponse {
  if (!res || typeof res !== 'object' || !('cookie' in res)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Cookie response unavailable',
    })
  }

  return res as CookieResponse
}

async function createParticipantToken(participantId: string) {
  return signJWT(
    {
      sub: participantId,
      role: UserRole.PARTICIPANT,
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '2w',
      issuer: process.env.APP_ORIGIN_API,
    }
  )
}

async function doParticipantLogin({
  participantId,
  participantLocale,
  prisma,
  res,
}: {
  participantId: string
  participantLocale: Locale
  prisma: PrismaClient
  res: unknown
}) {
  await prisma.participant.update({
    where: { id: participantId },
    data: { lastLoginAt: new Date() },
  })

  const jwt = await createParticipantToken(participantId)
  const cookieResponse = getCookieResponse(res)
  cookieResponse.cookie('participant_token', jwt, COOKIE_SETTINGS)
  cookieResponse.cookie('NEXT_LOCALE', participantLocale, COOKIE_SETTINGS)

  return jwt
}

async function createTransport() {
  if (transport) return transport

  if (process.env.EMAIL_TYPE === 'OAUTH') {
    return null
  }

  try {
    transport = nodemailer.createTransport({
      pool: true,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT
        ? parseInt(process.env.EMAIL_PORT)
        : undefined,
      secure: process.env.EMAIL_SECURE === 'true',
      requireTLS: process.env.EMAIL_STARTTLS === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    await transport.verify()
    console.log('Email transport verified')
  } catch (e) {
    console.error('Error creating email transport: ', e)
    return null
  }

  return transport
}

async function hydrateTemplate({
  prisma,
  variables = {},
}: {
  prisma: PrismaClient
  variables?: Record<string, string>
}) {
  let template

  try {
    template = await prisma.emailTemplate.findUnique({
      where: { name: 'MagicLinkRequested' },
    })

    if (!template) return null

    template = template.html
  } catch (e) {
    console.error('Error reading email template: ', e)
    return null
  }

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`[${key}]`, value)
  }

  return template
}

async function sendEmail({
  html,
  subject,
  text,
  to,
}: {
  html: string
  subject: string
  text: string
  to: string
}) {
  const transport = await createTransport()

  if (!transport) return false

  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    })
  } catch (e) {
    console.error('Error sending email: ', e)
    return false
  }

  return true
}

async function sendTeamsNotification({
  scope,
  text,
}: {
  scope: string
  text: string
}) {
  if (!process.env.TEAMS_WEBHOOK_URL) return null

  try {
    return await fetch(process.env.TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        '@context': 'https://schema.org/extensions',
        '@type': 'MessageCard',
        themeColor: '0076D7',
        title: scope,
        text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
      }),
    })
  } catch (error) {
    console.error('Failed to send Teams notification:', error)
    return null
  }
}

export async function loginParticipant({
  password,
  prisma,
  res,
  usernameOrEmail,
}: {
  password: string
  prisma: PrismaClient
  res: unknown
  usernameOrEmail: string
}) {
  const trimmedUsernameOrEmail = usernameOrEmail.trim()
  const participantWithUsername = await prisma.participant.findUnique({
    where: { username: trimmedUsernameOrEmail },
  })

  if (participantWithUsername) {
    const isLoginValid = await bcrypt.compare(
      password,
      participantWithUsername.password
    )
    if (!isLoginValid) return null

    await doParticipantLogin({
      participantId: participantWithUsername.id,
      participantLocale: participantWithUsername.locale,
      prisma,
      res,
    })

    return participantWithUsername.id
  }

  const candidates = await prisma.participant.findMany({
    where: {
      email: trimmedUsernameOrEmail.toLowerCase(),
    },
  })

  for (const candidate of candidates) {
    const isLoginValid = await bcrypt.compare(password, candidate.password)
    if (!isLoginValid) continue

    await doParticipantLogin({
      participantId: candidate.id,
      participantLocale: candidate.locale,
      prisma,
      res,
    })

    return candidate.id
  }

  return null
}

export async function sendMagicLink({
  prisma,
  usernameOrEmail,
}: {
  prisma: PrismaClient
  usernameOrEmail: string
}) {
  const trimmedUsernameOrEmail = usernameOrEmail.trim()
  const currentTime = Date.now()

  if (!rateLimitStore[trimmedUsernameOrEmail]) {
    rateLimitStore[trimmedUsernameOrEmail] = {
      count: 1,
      lastRequest: currentTime,
    }
  } else {
    const { count, lastRequest } = rateLimitStore[trimmedUsernameOrEmail]
    if (currentTime - lastRequest < TIME_WINDOW) {
      if (count >= RATE_LIMIT) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      rateLimitStore[trimmedUsernameOrEmail].count += 1
    } else {
      rateLimitStore[trimmedUsernameOrEmail] = {
        count: 1,
        lastRequest: currentTime,
      }
    }
  }

  const participants = await prisma.participant.findMany({
    where: {
      OR: [
        { username: trimmedUsernameOrEmail },
        { email: trimmedUsernameOrEmail.toLowerCase() },
      ],
    },
  })

  if (participants.length === 0) return true

  const participantData = participants[0]
  if (!participantData?.email) return false

  const magicLinkJWT = await signJWT(
    {
      sub: participantData.id,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.OTP,
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: process.env.APP_ORIGIN_API,
    }
  )

  const magicLink = `${process.env.APP_ORIGIN_PWA}/magicLogin?token=${magicLinkJWT}`
  const emailHtml = await hydrateTemplate({
    prisma,
    variables: { LINK: magicLink },
  })

  if (!emailHtml) return null

  await sendTeamsNotification({
    scope: 'graphql/sendMagicLink',
    text: `One-time login token created for ${usernameOrEmail}: ${magicLink}`,
  })

  await sendEmail({
    to: participantData.email,
    subject: 'KlickerUZH - Your One-Time Login Link',
    text: `Please click on the following link to log in to KlickerUZH PWA: ${magicLink} (validity: 15 minutes)`,
    html: emailHtml,
  })

  return true
}

export async function loginWithMagicLink({
  prisma,
  res,
  token,
}: {
  prisma: PrismaClient
  res: unknown
  token: string
}) {
  let tokenData: Awaited<ReturnType<typeof verifyJWT>>

  try {
    tokenData = await verifyJWT(token, process.env.APP_SECRET as string)
  } catch {
    return null
  }

  if (!tokenData.sub || tokenData.scope !== UserLoginScope.OTP) {
    return null
  }

  const participant = await prisma.participant.findUnique({
    where: { id: tokenData.sub },
  })

  if (!participant) return null

  await doParticipantLogin({
    participantId: participant.id,
    participantLocale: participant.locale,
    prisma,
    res,
  })

  return participant.id
}
