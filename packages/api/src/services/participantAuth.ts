import {
  PublicationStatus,
  UserLoginScope,
  UserRole,
  type Locale,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { normalizeEmail, signJWT, verifyJWT } from '@klicker-uzh/util'
import { TRPCError } from '@trpc/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
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

function isRecordNotFoundError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2025'
  )
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

async function createTemporaryParticipantToken(participantId: string) {
  return signJWT(
    {
      sub: participantId,
      role: UserRole.TEMPORARY_PARTICIPANT,
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

async function verifyParticipantLoginToken({
  scope,
  token,
}: {
  scope: UserLoginScope
  token: string
}) {
  let tokenData: Awaited<ReturnType<typeof verifyJWT>>

  try {
    tokenData = await verifyJWT(token, process.env.APP_SECRET as string)
  } catch {
    return null
  }

  if (!tokenData.sub || tokenData.scope !== scope) {
    return null
  }

  return tokenData.sub
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
  templateName = 'MagicLinkRequested',
  variables = {},
}: {
  prisma: PrismaClient
  templateName?: 'MagicLinkRequested' | 'ParticipantAccountActivation'
  variables?: Record<string, string>
}) {
  let template

  try {
    template = await prisma.emailTemplate.findUnique({
      where: { name: templateName },
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
  const participantId = await verifyParticipantLoginToken({
    scope: UserLoginScope.OTP,
    token,
  })

  if (!participantId) return null

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
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

export async function activateParticipantAccount({
  prisma,
  res,
  token,
}: {
  prisma: PrismaClient
  res: unknown
  token: string
}) {
  const participantId = await verifyParticipantLoginToken({
    scope: UserLoginScope.ACTIVATION,
    token,
  })

  if (!participantId) return null

  let participant

  try {
    participant = await prisma.participant.update({
      where: { id: participantId },
      data: { isEmailValid: true },
    })
  } catch (error) {
    if (isRecordNotFoundError(error)) return null
    throw error
  }

  await doParticipantLogin({
    participantId: participant.id,
    participantLocale: participant.locale,
    prisma,
    res,
  })

  return participant.id
}

export async function changeParticipantLocale({
  locale,
  participantId,
  prisma,
  res,
}: {
  locale: Locale
  participantId: string
  prisma: PrismaClient
  res: unknown
}) {
  const cookieResponse = getCookieResponse(res)
  cookieResponse.cookie('NEXT_LOCALE', locale, COOKIE_SETTINGS)

  return await prisma.participant.update({
    where: { id: participantId },
    data: { locale },
    select: { id: true, locale: true },
  })
}

export async function logoutParticipant({
  participantId,
  res,
}: {
  participantId: string
  res: unknown
}) {
  const cookieResponse = getCookieResponse(res)

  cookieResponse.cookie('participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })
  cookieResponse.cookie('next-auth.participant-session-token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  return participantId
}

export async function deleteParticipantAccount({
  participantId,
  prisma,
  res,
}: {
  participantId: string
  prisma: PrismaClient
  res: unknown
}) {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      participantGroups: {
        select: {
          id: true,
          participants: {
            select: { id: true },
          },
        },
      },
    },
  })

  if (!participant) return false

  const cookieResponse = getCookieResponse(res)
  cookieResponse.cookie('participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  const deletionPromises: Prisma.PrismaPromise<unknown>[] = []
  for (const group of participant.participantGroups) {
    if (group.participants.length === 1) {
      deletionPromises.push(
        prisma.participantGroup.delete({
          where: { id: group.id },
        })
      )
    }
  }

  deletionPromises.push(
    prisma.participant.delete({
      where: { id: participantId },
    })
  )

  await prisma.$transaction(deletionPromises)

  return true
}

type ParticipantAccountWithParticipant = Prisma.ParticipantAccountGetPayload<{
  include: { participant: true }
}>

type ResolveOrCreateParticipantForLtiResult =
  | {
      type: 'resolved'
      mode: 'linked_by_ssoid' | 'linked_by_email' | 'created_new'
      account: ParticipantAccountWithParticipant
    }
  | {
      type:
        | 'conflict_duplicate_email'
        | 'missing_email'
        | 'not_found'
        | 'username_taken'
        | 'invalid_create_input'
    }

function toParticipantAccountDto(participant: {
  id: string
  email: string | null
  username: string
}) {
  return {
    id: participant.id,
    email: participant.email,
    username: participant.username,
  }
}

async function validateJoinableCourse({
  courseId,
  prisma,
}: {
  courseId?: string | null
  prisma: PrismaClient
}) {
  if (!courseId) return true

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isAssessmentEnabled: true },
  })

  return !!course && !course.isAssessmentEnabled
}

async function resolveOrCreateParticipantForLti({
  allowCreate,
  courseId,
  isProfilePublic,
  password,
  prisma,
  signedLtiData,
  username,
}: {
  allowCreate: boolean
  courseId?: string
  isProfilePublic?: boolean
  password?: string
  prisma: PrismaClient
  signedLtiData: string
  username?: string
}): Promise<ResolveOrCreateParticipantForLtiResult> {
  const ltiData = (await verifyJWT(
    signedLtiData,
    process.env.APP_SECRET as string
  )) as {
    email?: string
    sub: string
    scope: string
  }

  return prisma.$transaction(async (transaction) => {
    const normalizedEmail = normalizeEmail(ltiData.email)

    const ensureParticipation = async (participantId: string) => {
      if (!courseId) return

      await transaction.participation.upsert({
        where: {
          courseId_participantId: { courseId, participantId },
        },
        create: {
          course: { connect: { id: courseId } },
          participant: { connect: { id: participantId } },
        },
        update: {},
      })
    }

    const accountBySsoId = await transaction.participantAccount.findUnique({
      where: { ssoId: ltiData.sub },
      include: { participant: true },
    })

    if (accountBySsoId) {
      const account =
        normalizedEmail && accountBySsoId.ssoEmail !== normalizedEmail
          ? await transaction.participantAccount.update({
              where: { id: accountBySsoId.id },
              data: { ssoEmail: normalizedEmail },
              include: { participant: true },
            })
          : accountBySsoId

      console.info(
        `event=lti_linked_by_ssoid participantId=${account.participant.id} ssoType=${account.ssoType}`
      )

      await ensureParticipation(account.participant.id)

      return {
        type: 'resolved',
        mode: 'linked_by_ssoid',
        account,
      }
    }

    if (normalizedEmail) {
      const matchedParticipants = await transaction.participant.findMany({
        where: { email: normalizedEmail },
      })

      if (matchedParticipants.length > 1) {
        console.warn(
          `event=lti_conflict_duplicate_email normalizedEmail=${normalizedEmail} matches=${matchedParticipants.length}`
        )
        return { type: 'conflict_duplicate_email' }
      }

      if (matchedParticipants.length === 1) {
        const participant = matchedParticipants[0]!

        const accountForSsoType =
          await transaction.participantAccount.findUnique({
            where: {
              participantId_ssoType: {
                participantId: participant.id,
                ssoType: ltiData.scope,
              },
            },
            include: { participant: true },
          })

        if (accountForSsoType) {
          const account =
            accountForSsoType.ssoId !== ltiData.sub ||
            accountForSsoType.ssoEmail !== normalizedEmail
              ? await transaction.participantAccount.update({
                  where: { id: accountForSsoType.id },
                  data: {
                    ssoId: ltiData.sub,
                    ssoEmail: normalizedEmail,
                  },
                  include: { participant: true },
                })
              : accountForSsoType

          console.info(
            `event=lti_linked_by_email participantId=${account.participant.id} ssoType=${account.ssoType} reusedSsoType=true`
          )

          await ensureParticipation(account.participant.id)

          return {
            type: 'resolved',
            mode: 'linked_by_email',
            account,
          }
        }

        const account = await transaction.participantAccount.create({
          data: {
            ssoId: ltiData.sub,
            ssoType: ltiData.scope,
            ssoEmail: normalizedEmail,
            participant: {
              connect: {
                id: participant.id,
              },
            },
          },
          include: { participant: true },
        })

        console.info(
          `event=lti_linked_by_email participantId=${account.participant.id} ssoType=${account.ssoType} reusedSsoType=false`
        )

        await ensureParticipation(account.participant.id)

        return {
          type: 'resolved',
          mode: 'linked_by_email',
          account,
        }
      }
    }

    if (!allowCreate) {
      return normalizedEmail ? { type: 'not_found' } : { type: 'missing_email' }
    }

    if (!normalizedEmail) {
      return { type: 'missing_email' }
    }

    if (!username || !password || typeof isProfilePublic !== 'boolean') {
      return { type: 'invalid_create_input' }
    }

    const trimmedUsername = username.trim()
    const existingUsername = await transaction.participant.findUnique({
      where: { username: trimmedUsername },
      select: { id: true },
    })

    if (existingUsername) {
      return { type: 'username_taken' }
    }

    const participant = await transaction.participant.create({
      data: {
        email: normalizedEmail,
        username: trimmedUsername,
        password: await bcrypt.hash(password, 10),
        isEmailValid: true,
        isProfilePublic,
        isSSOAccount: true,
        lastLoginAt: new Date(),
      },
    })

    const account = await transaction.participantAccount.create({
      data: {
        ssoId: ltiData.sub,
        ssoType: ltiData.scope,
        ssoEmail: normalizedEmail,
        participant: {
          connect: {
            id: participant.id,
          },
        },
      },
      include: { participant: true },
    })

    console.info(
      `event=lti_created_new participantId=${account.participant.id} ssoType=${account.ssoType}`
    )

    await ensureParticipation(account.participant.id)

    return {
      type: 'resolved',
      mode: 'created_new',
      account,
    }
  })
}

export async function createParticipantAccount({
  courseId,
  email,
  isProfilePublic,
  password,
  prisma,
  res,
  signedLtiData,
  username,
}: {
  courseId?: string | null
  email: string
  isProfilePublic: boolean
  password: string
  prisma: PrismaClient
  res: unknown
  signedLtiData?: string | null
  username: string
}) {
  const isCourseJoinable = await validateJoinableCourse({ courseId, prisma })
  if (!isCourseJoinable) return null

  if (signedLtiData) {
    const resolved = await resolveOrCreateParticipantForLti({
      allowCreate: true,
      courseId: courseId ?? undefined,
      isProfilePublic,
      password,
      prisma,
      signedLtiData,
      username,
    })

    if (resolved.type !== 'resolved') {
      console.warn(`event=lti_create_account_failed type=${resolved.type}`)
      return null
    }

    try {
      const jwt = await doParticipantLogin({
        participantId: resolved.account.participant.id,
        participantLocale: resolved.account.participant.locale,
        prisma,
        res,
      })

      return {
        participant: toParticipantAccountDto(resolved.account.participant),
        participantToken: jwt,
      }
    } catch (error) {
      console.error(error)
      return null
    }
  }

  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const existingParticipantWithEmail = await prisma.participant.findFirst({
    where: {
      email: normalizedEmail,
    },
    select: { id: true },
  })

  if (existingParticipantWithEmail) {
    return null
  }

  try {
    const participant = await prisma.$transaction(async (transaction) => {
      const participant = await transaction.participant.create({
        data: {
          email: normalizedEmail,
          username: username.trim(),
          password: await bcrypt.hash(password, 10),
          isEmailValid: false,
          isProfilePublic,
          isSSOAccount: false,
          lastLoginAt: new Date(),
        },
      })

      if (courseId) {
        await transaction.participation.upsert({
          where: {
            courseId_participantId: {
              courseId,
              participantId: participant.id,
            },
          },
          create: {
            course: { connect: { id: courseId } },
            participant: { connect: { id: participant.id } },
          },
          update: {},
        })
      }

      return participant
    })

    const activationJWT = await signJWT(
      {
        sub: participant.id,
        role: UserRole.PARTICIPANT,
        scope: UserLoginScope.ACTIVATION,
      },
      process.env.APP_SECRET as string,
      {
        algorithm: 'HS256',
        expiresIn: '60m',
        issuer: process.env.APP_ORIGIN_API,
      }
    )

    const activationLink = `${process.env.APP_ORIGIN_PWA}/activation?token=${activationJWT}`

    const emailHtml = await hydrateTemplate({
      prisma,
      templateName: 'ParticipantAccountActivation',
      variables: { LINK: activationLink },
    })

    if (!emailHtml) return null

    await sendTeamsNotification({
      scope: 'trpc/createParticipantAccount',
      text: `New participant account created: ${participant.email} with activation link ${activationLink}`,
    })

    await sendEmail({
      to: normalizedEmail,
      subject: 'KlickerUZH - Account Activation',
      text: `Please click on the following link to activate your KlickerUZH account: ${activationLink} (validity: 60 minutes)`,
      html: emailHtml,
    })

    return {
      participant: toParticipantAccountDto(participant),
      participantToken: null,
    }
  } catch (error) {
    console.error(error)
    await sendTeamsNotification({
      scope: 'trpc/createParticipantAccount',
      text: `Failed to create participant account: ${email} with error: ${
        error || 'missing'
      }`,
    })

    return null
  }
}

export async function loginParticipantWithLti({
  courseId,
  prisma,
  res,
  signedLtiData,
}: {
  courseId?: string | null
  prisma: PrismaClient
  res: unknown
  signedLtiData: string
}) {
  const isCourseJoinable = await validateJoinableCourse({ courseId, prisma })
  if (!isCourseJoinable) return null

  const resolved = await resolveOrCreateParticipantForLti({
    allowCreate: false,
    courseId: courseId ?? undefined,
    prisma,
    signedLtiData,
  })

  if (resolved.type !== 'resolved') {
    console.warn(`event=lti_login_failed type=${resolved.type}`)
    return null
  }

  const jwt = await doParticipantLogin({
    participantId: resolved.account.participant.id,
    participantLocale: resolved.account.participant.locale,
    prisma,
    res,
  })

  return {
    participant: {
      id: resolved.account.participant.id,
    },
    participantToken: jwt,
  }
}

export async function loginTemporaryParticipant({
  avatar,
  liveQuizId,
  prisma,
  pseudonym,
  res,
}: {
  avatar?: string | null
  liveQuizId: string
  prisma: PrismaClient
  pseudonym: string
  res: unknown
}) {
  const trimmedPseudonym = pseudonym.trim()
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: { id: liveQuizId, status: PublicationStatus.PUBLISHED },
  })

  if (!liveQuiz) return null

  const existingParticipant = await prisma.participant.findFirst({
    where: { username: trimmedPseudonym },
  })

  if (existingParticipant) return null

  const existingTemporaryParticipant =
    await prisma.temporaryLeaderboardEntry.findFirst({
      where: {
        username: trimmedPseudonym,
        quizId: liveQuizId,
      },
    })

  if (existingTemporaryParticipant) return null

  const temporaryParticipant = await prisma.temporaryLeaderboardEntry.create({
    data: {
      id: randomUUID(),
      username: trimmedPseudonym,
      avatar: avatar ?? undefined,
      score: 0,
      quiz: {
        connect: { id: liveQuizId },
      },
    },
  })

  const jwt = await createTemporaryParticipantToken(temporaryParticipant.id)
  const cookieResponse = getCookieResponse(res)
  cookieResponse.cookie('temporary_participant_token', jwt, COOKIE_SETTINGS)

  return jwt
}

export async function logoutTemporaryParticipant({
  liveQuizId,
  participantId,
  prisma,
  res,
}: {
  liveQuizId: string
  participantId: string
  prisma: PrismaClient
  res: unknown
}) {
  const temporaryLeaderboardEntry =
    await prisma.temporaryLeaderboardEntry.findUnique({
      where: { id_quizId: { id: participantId, quizId: liveQuizId } },
    })

  if (!temporaryLeaderboardEntry) return false

  await prisma.temporaryLeaderboardEntry.delete({
    where: { id_quizId: { id: participantId, quizId: liveQuizId } },
  })

  const cookieResponse = getCookieResponse(res)
  cookieResponse.cookie('temporary_participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  return true
}
