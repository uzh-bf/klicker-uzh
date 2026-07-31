import * as DB from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  normalizeEmail,
  processElementData,
  recomputeDerivedPermissions,
  signJWT,
  verifyJWT,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import type { CookieOptions } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import * as EmailService from '../services/email.js'
import { sendTeamsNotification } from './notifications.js'

const COOKIE_SETTINGS: CookieOptions = {
  domain: process.env.COOKIE_DOMAIN,
  path: '/',
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24 * 30,
  secure:
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1',
  sameSite: 'lax',
}

export async function logoutUser(_: any, ctx: ContextWithUser) {
  ctx.res.cookie('next-auth.session-token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  return ctx.user.sub
}

export async function createParticipantToken(participantId: string) {
  return signJWT(
    {
      sub: participantId,
      role: DB.UserRole.PARTICIPANT,
    },
    // TODO: use structured configuration approach
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '2w',
      issuer: process.env.APP_ORIGIN_API,
    }
  )
}

export async function createTemporaryParticipantToken(participantId: string) {
  return signJWT(
    {
      sub: participantId,
      role: DB.UserRole.TEMPORARY_PARTICIPANT,
    },
    // TODO: use structured configuration approach
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '2w',
      issuer: process.env.APP_ORIGIN_API,
    }
  )
}

async function doParticipantLogin(
  {
    participantId,
    participantLocale,
  }: { participantId: string; participantLocale: DB.Locale },
  ctx: Context
) {
  await ctx.prisma.participant.update({
    where: { id: participantId },
    data: { lastLoginAt: new Date() },
  })

  const jwt = await createParticipantToken(participantId)
  ctx.res.cookie('participant_token', jwt, COOKIE_SETTINGS)
  ctx.res.cookie('NEXT_LOCALE', participantLocale, COOKIE_SETTINGS)

  return jwt
}

interface LoginParticipantArgs {
  usernameOrEmail: string
  password: string
}

export async function loginParticipant(
  { usernameOrEmail, password }: LoginParticipantArgs,
  ctx: Context
) {
  const participantWithUsername = await ctx.prisma.participant.findUnique({
    where: { username: usernameOrEmail.trim() },
  })

  if (participantWithUsername) {
    const isLoginValid = await bcrypt.compare(
      password,
      participantWithUsername.password
    )
    if (!isLoginValid) return null

    await doParticipantLogin(
      {
        participantId: participantWithUsername.id,
        participantLocale: participantWithUsername.locale,
      },
      ctx
    )

    return participantWithUsername.id
  }

  // The schema permits one manual (isSSOAccount=false) and one SSO row per
  // email. Try bcrypt against every candidate so a user with both rows can
  // sign in with whichever password actually matches; SSO-only accounts have
  // an unguessable random hash and so cannot accidentally authenticate here.
  const candidates = await ctx.prisma.participant.findMany({
    where: {
      email: usernameOrEmail.trim().toLowerCase(),
    },
  })

  for (const candidate of candidates) {
    const isLoginValid = await bcrypt.compare(password, candidate.password)
    if (!isLoginValid) continue

    await doParticipantLogin(
      {
        participantId: candidate.id,
        participantLocale: candidate.locale,
      },
      ctx
    )

    return candidate.id
  }

  return null
}

export async function loginTemporaryParticipant(
  {
    liveQuizId,
    pseudonym,
    avatar,
  }: { liveQuizId: string; pseudonym: string; avatar?: string | null },
  ctx: Context
) {
  // check if the live quiz exists and is running
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: liveQuizId, status: DB.PublicationStatus.PUBLISHED },
  })

  if (!liveQuiz) {
    return null
  }

  // verify that no other participant or temporary participant in this live quiz exists with the same pseudonym
  const existingParticipant = await ctx.prisma.participant.findFirst({
    where: { username: pseudonym.trim() },
  })

  if (existingParticipant) {
    return null // error: 'pseudonym already taken'
  }

  const existingTemporaryParticipant =
    await ctx.prisma.temporaryLeaderboardEntry.findFirst({
      where: {
        username: pseudonym.trim(),
        quizId: liveQuizId,
      },
    })

  if (existingTemporaryParticipant) {
    return null // error: 'pseudonym already taken'
  }

  // create a temporary leaderboard entry linked to the mentioned live quiz
  const temporaryParticipant =
    await ctx.prisma.temporaryLeaderboardEntry.create({
      data: {
        id: uuidv4(),
        username: pseudonym.trim(),
        avatar: avatar ?? undefined,
        score: 0,
        quiz: {
          connect: { id: liveQuizId },
        },
      },
    })

  // create and return a new valid token for the temporary participant
  const jwt = await createTemporaryParticipantToken(temporaryParticipant.id)
  ctx.res.cookie('temporary_participant_token', jwt, COOKIE_SETTINGS)
  return jwt
}

const rateLimitStore: Record<string, { count: number; lastRequest: number }> =
  {}
const RATE_LIMIT = 5 // Maximum number of requests
const TIME_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

interface SendMagicLinkArgs {
  usernameOrEmail: string
}

export async function sendMagicLink(
  { usernameOrEmail }: SendMagicLinkArgs,
  ctx: Context
) {
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

  // the returned count can never be more than one, as the username cannot be a valid email (and vice versa)
  const participantWithUsername = await ctx.prisma.participant.findMany({
    where: {
      OR: [
        { username: trimmedUsernameOrEmail },
        { email: trimmedUsernameOrEmail.toLowerCase() },
      ],
    },
  })

  if (participantWithUsername.length === 0) return true

  const participantData = participantWithUsername[0]

  // TODO: should we disable magic link login until the email has been verified?
  if (!participantData?.email) return false

  const magicLinkJWT = await signJWT(
    {
      sub: participantData.id,
      role: DB.UserRole.PARTICIPANT,
      scope: DB.UserLoginScope.OTP,
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: process.env.APP_ORIGIN_API,
    }
  )

  const magicLink = `${process.env.APP_ORIGIN_PWA}/magicLogin?token=${magicLinkJWT}`

  const emailHtml = await EmailService.hydrateTemplate(
    {
      templateName: 'MagicLinkRequested',
      variables: { LINK: magicLink },
    },
    ctx.prisma
  )

  if (!emailHtml) return null

  await sendTeamsNotification({
    scope: 'graphql/sendMagicLink',
    text: `One-time login token created for ${usernameOrEmail}: ${magicLink}`,
  })

  await EmailService.sendEmail({
    to: participantData.email,
    subject: 'KlickerUZH - Your One-Time Login Link',
    text: `Please click on the following link to log in to KlickerUZH PWA: ${magicLink} (validity: 15 minutes)`,
    html: emailHtml,
  })

  return true
}

export async function loginParticipantMagicLink(
  { token }: { token: string },
  ctx: Context
) {
  //
  const tokenData = (await verifyJWT(
    token,
    process.env.APP_SECRET as string
  )) as {
    sub: string
    scope: DB.UserLoginScope
  }

  if (!tokenData.sub || tokenData.scope !== DB.UserLoginScope.OTP) {
    return null
  }

  const participant = await ctx.prisma.participant.findUnique({
    where: {
      id: tokenData.sub,
    },
  })

  if (participant) {
    await doParticipantLogin(
      {
        participantId: participant.id,
        participantLocale: participant.locale,
      },
      ctx
    )

    return participant.id
  }

  return null
}

export async function activateParticipantAccount(
  { token }: { token: string },
  ctx: Context
) {
  //
  const tokenData = (await verifyJWT(
    token,
    process.env.APP_SECRET as string
  )) as {
    sub: string
    scope: DB.UserLoginScope
  }

  if (!tokenData.sub || tokenData.scope !== DB.UserLoginScope.ACTIVATION) {
    return null
  }

  const participant = await ctx.prisma.participant.update({
    where: {
      id: tokenData.sub,
    },
    data: {
      isEmailValid: true,
    },
  })

  if (participant) {
    await doParticipantLogin(
      {
        participantId: participant.id,
        participantLocale: participant.locale,
      },
      ctx
    )

    return participant.id
  }

  return null
}

export async function logoutParticipant(ctx: ContextWithUser) {
  // invalidate regular participant token
  ctx.res.cookie('participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  // invalidate assessment / Edu-ID participant token
  ctx.res.cookie('next-auth.participant-session-token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  return ctx.user.sub
}

export async function logoutTemporaryParticipant(
  { liveQuizId }: { liveQuizId: string },
  ctx: ContextWithUser
) {
  // verify that the requesting user is a temporary participant
  if (ctx.user.role !== DB.UserRole.TEMPORARY_PARTICIPANT) {
    return false // not a temporary participant
  }

  // check if there exists a temporary leaderboard entry for the current user
  const lbEntry = await ctx.prisma.temporaryLeaderboardEntry.findUnique({
    where: { id_quizId: { id: ctx.user.sub, quizId: liveQuizId } },
  })

  if (!lbEntry) {
    return false // no temporary participant found
  }

  // delete the temporary leaderboard entry
  await ctx.prisma.temporaryLeaderboardEntry.delete({
    where: { id_quizId: { id: ctx.user.sub, quizId: liveQuizId } },
  })

  // delete the cookie
  ctx.res.cookie('temporary_participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  return true
}

export async function changeUserLocale(
  { locale }: { locale: DB.Locale },
  ctx: ContextWithUser
) {
  const user = await ctx.prisma.user.update({
    where: { id: ctx.user.sub },
    data: { locale },
  })

  if (!user) return null

  ctx.res.cookie('NEXT_LOCALE', locale, COOKIE_SETTINGS)

  return user
}

export async function getUsersPrivatePreview(ctx: ContextWithUser) {
  // verify that the user has ADMIN permissions
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
  })

  if (!user || user.role !== DB.UserRole.ADMIN) {
    return []
  }

  const users = await ctx.prisma.user.findMany({
    where: { privatePreview: true },
    select: { shortname: true, email: true },
  })

  return users.map((user) => ({
    shortname: user.shortname,
    email: user.email,
  }))
}

export async function grantPrivatePreviewAccess(
  { email }: { email: string },
  ctx: ContextWithUser
) {
  // verif ythat the user has ADMIN permissions (can grant new access)
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
  })
  if (!user || user.role !== DB.UserRole.ADMIN) {
    return null
  }

  // check if the new user exists
  const newUser = await ctx.prisma.user.findUnique({
    where: { email },
  })
  if (!newUser) {
    return 1
  }

  // check if the new user already has access
  if (newUser.privatePreview) {
    return 2
  }

  // grant access to the new user
  await ctx.prisma.user.update({
    where: { id: newUser.id },
    data: { privatePreview: true },
  })
  await sendTeamsNotification({
    scope: 'graphql/grantPrivatePreviewAccess',
    text: `User ${newUser.shortname} (${newUser.email}) granted private preview access`,
  })

  return 0
}

export async function changeParticipantLocale(
  { locale }: { locale: DB.Locale },
  ctx: Context
) {
  ctx.res.cookie('NEXT_LOCALE', locale, COOKIE_SETTINGS)

  if (!ctx.user) return null

  const participant = await ctx.prisma.participant.update({
    where: { id: ctx.user.sub },
    data: { locale },
  })

  if (!participant) return null

  return participant
}

export async function deleteParticipantAccount(ctx: ContextWithUser) {
  const participant = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    include: {
      participantGroups: {
        include: {
          participants: true,
        },
      },
    },
  })

  if (!participant) return false

  ctx.res.cookie('participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  // if a participant group is empty after the participant leaves it, delete the group as well
  let deletionPromises: any[] = []
  for (const group of participant.participantGroups) {
    if (group.participants.length === 1) {
      deletionPromises.push(
        ctx.prisma.participantGroup.delete({
          where: { id: group.id },
        })
      )
    }
  }

  deletionPromises.push(
    ctx.prisma.participant.delete({
      where: { id: ctx.user.sub },
    })
  )

  await ctx.prisma.$transaction(deletionPromises)
  return true
}

type ResolveOrCreateParticipantForLtiResult =
  | {
      type: 'resolved'
      mode: 'linked_by_ssoid' | 'linked_by_email' | 'created_new'
      account: DB.ParticipantAccount & { participant: DB.Participant }
    }
  | {
      type:
        | 'conflict_duplicate_email'
        | 'missing_email'
        | 'not_found'
        | 'username_taken'
        | 'invalid_create_input'
    }

interface ResolveOrCreateParticipantForLtiArgs {
  signedLtiData: string
  allowCreate: boolean
  username?: string
  password?: string
  isProfilePublic?: boolean
  courseId?: string
}

async function resolveOrCreateParticipantForLti(
  {
    signedLtiData,
    allowCreate,
    username,
    password,
    isProfilePublic,
    courseId,
  }: ResolveOrCreateParticipantForLtiArgs,
  ctx: Context
): Promise<ResolveOrCreateParticipantForLtiResult> {
  const ltiData = (await verifyJWT(
    signedLtiData,
    process.env.APP_SECRET as string
  )) as {
    email?: string
    sub: string
    scope: string
  }

  return ctx.prisma.$transaction(async (prisma) => {
    const normalizedEmail = normalizeEmail(ltiData.email)

    const ensureParticipation = async (participantId: string) => {
      if (courseId) {
        await prisma.participation.upsert({
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
    }

    const accountBySsoId = await prisma.participantAccount.findUnique({
      where: { ssoId: ltiData.sub },
      include: { participant: true },
    })

    if (accountBySsoId) {
      const account =
        normalizedEmail && accountBySsoId.ssoEmail !== normalizedEmail
          ? await prisma.participantAccount.update({
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
      const matchedParticipants = await prisma.participant.findMany({
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

        const accountForSsoType = await prisma.participantAccount.findUnique({
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
              ? await prisma.participantAccount.update({
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

        const account = await prisma.participantAccount.create({
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
    const existingUsername = await prisma.participant.findUnique({
      where: { username: trimmedUsername },
      select: { id: true },
    })

    if (existingUsername) {
      return { type: 'username_taken' }
    }

    const participant = await prisma.participant.create({
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

    const account = await prisma.participantAccount.create({
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

interface CreateParticipantAccountArgs {
  email: string
  username: string
  password: string
  isProfilePublic: boolean
  courseId?: string | null
  signedLtiData?: string | null
}

export async function createParticipantAccount(
  {
    email,
    isProfilePublic,
    username,
    password,
    courseId,
    signedLtiData,
  }: CreateParticipantAccountArgs,
  ctx: Context
) {
  // verify that the course that should be joined is not an assessment course
  if (courseId) {
    const course = await ctx.prisma.course.findUnique({
      where: { id: courseId },
    })

    if (!course || course.isAssessmentEnabled) {
      return null
    }
  }

  if (signedLtiData) {
    const resolved = await resolveOrCreateParticipantForLti(
      {
        signedLtiData,
        allowCreate: true,
        username,
        password,
        isProfilePublic,
        courseId: courseId ?? undefined,
      },
      ctx
    )
    if (resolved.type !== 'resolved') {
      console.warn(`event=lti_create_account_failed type=${resolved.type}`)
      return null
    }

    const account = resolved.account

    try {
      const jwt = await doParticipantLogin(
        {
          participantId: account.participant.id,
          participantLocale: account.participant.locale,
        },
        ctx
      )

      return {
        participant: account.participant,
        participantToken: jwt,
      }
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const existingParticipantWithEmail = await ctx.prisma.participant.findFirst({
    where: {
      email: normalizedEmail,
    },
    select: { id: true },
  })

  if (existingParticipantWithEmail) {
    return null
  }

  try {
    const participant = await ctx.prisma.$transaction(async (prisma) => {
      const participant = await prisma.participant.create({
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

      // if a courseId is specified, add a participation in the corresponding course
      if (courseId) {
        await prisma.participation.upsert({
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

    if (!participant) return null

    const activationJWT = await signJWT(
      {
        sub: participant.id,
        role: DB.UserRole.PARTICIPANT,
        scope: DB.UserLoginScope.ACTIVATION,
      },
      process.env.APP_SECRET as string,
      {
        algorithm: 'HS256',
        expiresIn: '60m',
        issuer: process.env.APP_ORIGIN_API,
      }
    )

    const activationLink = `${process.env.APP_ORIGIN_PWA}/activation?token=${activationJWT}`

    const emailHtml = await EmailService.hydrateTemplate(
      {
        templateName: 'ParticipantAccountActivation',
        variables: { LINK: activationLink },
      },
      ctx.prisma
    )

    if (!emailHtml) return null

    await sendTeamsNotification({
      scope: 'graphql/createParticipantAccount',
      text: `New participant account created: ${participant.email} with activation link ${activationLink}`,
    })

    await EmailService.sendEmail({
      to: email,
      subject: 'KlickerUZH - Account Activation',
      text: `Please click on the following link to activate your KlickerUZH account: ${activationLink} (validity: 60 minutes)`,
      html: emailHtml,
    })

    return {
      participant,
    }
  } catch (e) {
    console.error(e)
    await sendTeamsNotification({
      scope: 'graphql/createParticipantAccount',
      text: `Failed to create participant account: ${email} with error: ${
        e || 'missing'
      }`,
    })

    return null
  }
}

interface LoginParticipantWithLtiArgs {
  signedLtiData: string
  courseId?: string | null
}

export async function loginParticipantWithLti(
  { signedLtiData, courseId }: LoginParticipantWithLtiArgs,
  ctx: Context
) {
  // verify that the course that should be joined is not an assessment course
  if (courseId) {
    const course = await ctx.prisma.course.findUnique({
      where: { id: courseId },
    })

    if (!course || course.isAssessmentEnabled) {
      return null
    }
  }

  const resolved = await resolveOrCreateParticipantForLti(
    {
      signedLtiData,
      allowCreate: false,
      courseId: courseId ?? undefined,
    },
    ctx
  )

  if (resolved.type !== 'resolved') {
    console.warn(`event=lti_login_failed type=${resolved.type}`)
    return null
  }

  const account = resolved.account

  const jwt = await doParticipantLogin(
    {
      participantId: account.participant.id,
      participantLocale: account.participant.locale,
    },
    ctx
  )

  return {
    participant: account.participant,
    participantToken: jwt,
  }
}

export async function getUserLogins(ctx: ContextWithUser) {
  const logins = await ctx.prisma.userLogin.findMany({
    where: { user: { id: ctx.user.sub } },
    include: { user: true },
    orderBy: { scope: 'asc' },
  })

  return logins
}

export async function checkParticipantNameAvailable(
  { username }: { username: string },
  ctx: Context
) {
  const participant = await ctx.prisma.participant.findUnique({
    where: { username: username.trim() },
  })

  if (
    !participant ||
    (ctx.user?.role === DB.UserRole.PARTICIPANT &&
      participant.id === ctx.user?.sub)
  )
    return true

  return false
}

export async function checkShortnameAvailable(
  { shortname }: { shortname: string },
  ctx: Context
) {
  const user = await ctx.prisma.user.findUnique({
    where: { shortname: shortname.trim() },
  })

  if (!user || user.id === ctx.user?.sub) return true

  return false
}

interface UserLoginProps {
  password: string
  name: string
  scope: DB.UserLoginScope
}

export async function createUserLogin(
  { password, name }: UserLoginProps,
  ctx: ContextWithUser
) {
  // verify that the user is account owner
  if (ctx.user.scope !== DB.UserLoginScope.ACCOUNT_OWNER) {
    return null
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const login = await ctx.prisma.userLogin.create({
    data: {
      password: hashedPassword,
      name: name.trim(),
      // scope,
      // TODO: allow creation of other access levels once auth is handled granularly
      scope: DB.UserLoginScope.FULL_ACCESS,
      user: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      user: true,
    },
  })

  return login
}

export async function updateUserLogin(
  {
    id,
    password,
  }: {
    id: string
    password: string
  },
  ctx: ContextWithUser
) {
  // check if the user is the owner of the account belonging to the login
  const login = await ctx.prisma.userLogin.findUnique({
    where: { id, userId: ctx.user.sub },
  })

  if (!login || ctx.user.scope !== DB.UserLoginScope.ACCOUNT_OWNER) {
    return null
  }

  // update the password
  const hashedPassword = await bcrypt.hash(password, 12)
  const updatedLogin = await ctx.prisma.userLogin.update({
    where: { id },
    data: { password: hashedPassword },
    include: { user: true },
  })

  return updatedLogin
}

export async function deleteUserLogin(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const login = await ctx.prisma.userLogin.findUnique({
    where: { id },
  })

  if (!login) return null

  const deletedItem = await ctx.prisma.userLogin.delete({
    where: { id },
  })

  return deletedItem
}

export async function changeShortname(
  { shortname }: { shortname: string },
  ctx: ContextWithUser
) {
  // verify that the trimmed shortname does not have a length of less than 5 and more than 10 characters (limit)
  const trimmedShortname = shortname.trim()
  if (trimmedShortname.length < 5 || trimmedShortname.length > 10) {
    return null
  }

  // check if the shortname is already taken
  const existingUser = await ctx.prisma.user.findUnique({
    where: { shortname: trimmedShortname },
  })

  if (existingUser && existingUser.id !== ctx.user.sub) {
    // another user already uses the requested shortname, returning old user
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.sub },
    })

    return user
  }

  const user = await ctx.prisma.user.update({
    where: { id: ctx.user.sub },
    data: { shortname: trimmedShortname },
  })

  return user
}

export async function changeEmailSettings(
  { projectUpdates }: { projectUpdates: boolean },
  ctx: ContextWithUser
) {
  const user = await ctx.prisma.user.update({
    where: { id: ctx.user.sub },
    data: { sendProjectUpdates: projectUpdates },
  })

  return user
}

export async function changeInitialSettings(
  {
    shortname,
    locale,
    sendUpdates,
    seedDemoElements,
  }: {
    shortname: string
    locale: DB.Locale
    sendUpdates: boolean
    seedDemoElements: boolean
  },
  ctx: ContextWithUser
) {
  const existingUser = await ctx.prisma.user.findFirst({
    where: { shortname: shortname.trim() },
  })

  if (existingUser && existingUser.id !== ctx.user.sub) {
    // another user already uses the shortname this user wants
    const user = await ctx.prisma.user.update({
      where: { id: ctx.user.sub },
      data: { locale },
    })
    return user
  }

  // seed demo questions
  if (seedDemoElements) {
    await seedDemoQuestions(ctx)
  }

  const user = await ctx.prisma.user.update({
    where: { id: ctx.user.sub },
    data: {
      shortname: shortname.trim(),
      locale,
      sendProjectUpdates: sendUpdates,
      firstLogin: false,
    },
  })

  return user
}

async function seedDemoSelectionAndCaseStudyElements(ctx: ContextWithUser) {
  return ctx.prisma.$transaction(async (prisma) => {
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Demo Teaching Activities',
        description:
          'Reusable teaching activities used by the demo selection and case study questions.',
        entries: {
          create: [
            'Live poll',
            'Think-pair-share',
            'Small-group case discussion',
            'One-minute paper',
            'Mini-lecture',
            'Instructor demonstration',
          ].map((value) => ({ value })),
        },
        owner: { connect: { id: ctx.user.sub } },
      },
      include: { entries: true },
    })

    const getEntryId = (value: string) => {
      const entry = answerCollection.entries.find(
        (candidate) => candidate.value === value
      )
      if (!entry) {
        throw new Error(`Demo answer collection entry missing: ${value}`)
      }
      return entry.id
    }

    const questionSE = await prisma.element.create({
      data: {
        name: 'Demoquestion SE',
        type: DB.ElementType.SELECTION,
        content:
          'You are teaching a large lecture and want to collect an individual response from every student. Select the two activities that meet this requirement.',
        explanation:
          'Live polls and one-minute papers collect an individual response from each student. Other activities can be highly interactive, but do not necessarily capture a response from everyone.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          numberOfInputs: 2,
        },
        owner: { connect: { id: ctx.user.sub } },
        tags: {
          connect: {
            ownerId_name: { ownerId: ctx.user.sub, name: 'Demo Tag' },
          },
        },
        answerCollection: { connect: { id: answerCollection.id } },
        answerCollectionItems: {
          connect: [
            { id: getEntryId('Live poll') },
            { id: getEntryId('One-minute paper') },
          ],
        },
      },
      include: {
        answerCollection: { include: { entries: true } },
        answerCollectionItems: true,
      },
    })

    const questionCS = await prisma.element.create({
      data: {
        name: 'Demoquestion CS',
        type: DB.ElementType.CASE_STUDY,
        content:
          'Compare four teaching activities in two teaching settings. For each case, rate every activity by expected student engagement, preparation effort, and in-class time.',
        explanation:
          'The sample ranges are illustrative rather than universally correct. Appropriate ratings depend on how each activity is designed and facilitated.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          criteria: [
            {
              id: 'demo-engagement',
              name: 'Expected engagement',
              order: 0,
              min: 1,
              max: 5,
              step: 1,
            },
            {
              id: 'demo-preparation',
              name: 'Preparation effort',
              order: 1,
              min: 1,
              max: 5,
              step: 1,
            },
            {
              id: 'demo-time',
              name: 'In-class time',
              order: 2,
              min: 1,
              max: 20,
              step: 1,
              unit: 'min',
            },
          ],
          cases: [
            {
              id: 'demo-large-lecture',
              title: 'Large introductory lecture',
              description:
                'You are teaching an introductory lecture with 300 students in fixed seating. You have at most 20 minutes for an activity and need an approach that works at scale.',
              order: 0,
              solutions: [
                {
                  itemId: getEntryId('Live poll'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 3, max: 5 },
                    { criterionId: 'demo-preparation', min: 2, max: 3 },
                    { criterionId: 'demo-time', min: 3, max: 7 },
                  ],
                },
                {
                  itemId: getEntryId('Think-pair-share'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 4, max: 5 },
                    { criterionId: 'demo-preparation', min: 1, max: 2 },
                    { criterionId: 'demo-time', min: 6, max: 10 },
                  ],
                },
                {
                  itemId: getEntryId('Small-group case discussion'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 3, max: 4 },
                    { criterionId: 'demo-preparation', min: 3, max: 5 },
                    { criterionId: 'demo-time', min: 12, max: 20 },
                  ],
                },
                {
                  itemId: getEntryId('Mini-lecture'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 1, max: 2 },
                    { criterionId: 'demo-preparation', min: 2, max: 4 },
                    { criterionId: 'demo-time', min: 10, max: 20 },
                  ],
                },
              ],
            },
            {
              id: 'demo-small-seminar',
              title: 'Small advanced seminar',
              description:
                'You are teaching an advanced seminar with 20 students in a room with flexible seating. You can devote up to 20 minutes to an activity and want students to engage deeply with the material.',
              order: 1,
              solutions: [
                {
                  itemId: getEntryId('Live poll'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 2, max: 4 },
                    { criterionId: 'demo-preparation', min: 2, max: 3 },
                    { criterionId: 'demo-time', min: 3, max: 7 },
                  ],
                },
                {
                  itemId: getEntryId('Think-pair-share'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 4, max: 5 },
                    { criterionId: 'demo-preparation', min: 1, max: 2 },
                    { criterionId: 'demo-time', min: 6, max: 10 },
                  ],
                },
                {
                  itemId: getEntryId('Small-group case discussion'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 4, max: 5 },
                    { criterionId: 'demo-preparation', min: 3, max: 5 },
                    { criterionId: 'demo-time', min: 12, max: 20 },
                  ],
                },
                {
                  itemId: getEntryId('Mini-lecture'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 1, max: 3 },
                    { criterionId: 'demo-preparation', min: 2, max: 4 },
                    { criterionId: 'demo-time', min: 10, max: 20 },
                  ],
                },
              ],
            },
          ],
        },
        owner: { connect: { id: ctx.user.sub } },
        tags: {
          connect: {
            ownerId_name: { ownerId: ctx.user.sub, name: 'Demo Tag' },
          },
        },
        answerCollection: { connect: { id: answerCollection.id } },
        answerCollectionItems: {
          connect: [
            { id: getEntryId('Live poll') },
            { id: getEntryId('Think-pair-share') },
            { id: getEntryId('Small-group case discussion') },
            { id: getEntryId('Mini-lecture') },
          ],
        },
      },
      include: {
        answerCollection: { include: { entries: true } },
        answerCollectionItems: true,
      },
    })

    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id, userId: ctx.user.sub },
      prisma
    )
    await recomputeDerivedPermissions(
      { elementId: questionSE.id, userId: ctx.user.sub },
      prisma
    )
    await recomputeDerivedPermissions(
      { elementId: questionCS.id, userId: ctx.user.sub },
      prisma
    )

    return { questionSE, questionCS }
  })
}

async function seedDemoQuestions(ctx: ContextWithUser) {
  // create single choice demo question
  const questionSC = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion SC',
      type: DB.ElementType.SC,
      content:
        'Which of the following statements is applicable to _KlickerUZH_?',
      options: {
        displayMode: DisplayMode.GRID,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          {
            ix: 0,
            value: 'KlickerUZH is owned by Google',
            correct: false,
            feedback: 'False!',
          },
          {
            ix: 1,
            value: 'KlickerUZH is an open-source audience response system',
            correct: true,
            feedback: 'Correct! The source code is available on GitHub.',
          },
          {
            ix: 2,
            value: 'KlickerUZH cannot be used by everyone',
            correct: false,
            feedback: 'False!',
          },
          {
            ix: 3,
            value: 'KlickerUZH is not a project of the University of Zurich',
            correct: false,
            feedback: 'False!',
          },
        ],
      },
      explanation:
        'For Single Choice questions, you can specify a correct solution, answer feedbacks and a general explanation. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 1,
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
      tags: {
        connectOrCreate: {
          where: {
            ownerId_name: {
              ownerId: ctx.user.sub,
              name: 'Demo Tag',
            },
          },
          create: {
            name: 'Demo Tag',
            owner: {
              connect: {
                id: ctx.user.sub,
              },
            },
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionSC.id, userId: ctx.user.sub },
    ctx.prisma
  )

  // create multiple choice demo question
  const questionMC = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion MC',
      type: DB.ElementType.MC,
      content:
        'Which of the following formulas have the form of a Taylor polynomial of some degree $$n$$: $$T_n f(x;a)$$? (multiple answers are possible)',
      options: {
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          {
            ix: 0,
            correct: false,
            value:
              '$$T_n f(x;a) = \\sum_{|\\alpha| = 0}^{n} (x - a)^\\alpha D^\\alpha f(a-x)$$',
            feedback: 'False!',
          },
          {
            ix: 1,
            correct: true,
            value:
              "$$T_n f(x;a) = f(a) + \\frac{f'(a)}{1!}(x - a) + \\frac{f''(a)}{2!}(x - a)^2 + ... + \\frac{f^{(n)}(a)}{n!}(x - a)^n$$",
            feedback:
              'Correct! This is the general form of a Taylor polynomial of degree $$n$$.',
          },
          {
            ix: 2,
            correct: true,
            value: '$$T_4 sin(x;0) = x - \\frac{x^3}{6}$$',
            feedback:
              'Correct! This is the Taylor polynomial of degree $$4$$ of $$sin(x)$$ around $$x = 0$$.',
          },
          {
            ix: 3,
            correct: false,
            value: '$$T_4 cos(x;0) = x + \\frac{x^3}{6}$$',
            feedback: 'False! This is not a Taylor polynomial of $$cos(x)$$.',
          },
        ],
      },
      explanation:
        'Multiple Choice questions can have multiple correct answers. You can specify answer feedbacks and a general explanation. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 2,
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: ctx.user.sub,
            name: 'Demo Tag',
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionMC.id, userId: ctx.user.sub },
    ctx.prisma
  )

  // create KPRIM demo question
  const questionKPRIM = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion KPRIM',
      type: DB.ElementType.KPRIM,
      content:
        'Which of the following statements is applicable to _KlickerUZH_? (multiple correct answers possible)',
      options: {
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          {
            ix: 0,
            value: 'KlickerUZH is owned by Google',
            correct: false,
            feedback: 'False!',
          },
          {
            ix: 1,
            value: 'KlickerUZH is an open-source audience response system',
            correct: true,
            feedback: 'Correct! The source code is available on GitHub.',
          },
          {
            ix: 2,
            value: 'KlickerUZH cannot be used by everyone',
            correct: false,
            feedback: 'False!',
          },
          {
            ix: 3,
            value:
              'KlickerUZH can be used in lecture settings with serveral hundred students',
            correct: true,
            feedback:
              'Correct! KlickerUZH is designed for large audiences and can handle thousands of concurrent users.',
          },
        ],
      },
      explanation:
        'KPRIM questions differ from Multiple Choice questions in that they use a different grading approach and consist of exactly four answer possibilities, which have to be selected to be true or false. You can specify answer feedbacks and a general explanation. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 3,
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: ctx.user.sub,
            name: 'Demo Tag',
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionKPRIM.id, userId: ctx.user.sub },
    ctx.prisma
  )

  // create Numerical demo question
  const questionNR = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion NR',
      type: DB.ElementType.NUMERICAL,
      content:
        'Estimate the length of the **longest** river in the world (answer in kilometres).',
      options: {
        hasSampleSolution: true,
        unit: 'km',
        accuracy: 0,
        restrictions: { max: 10000, min: 0 },
        solutionRanges: [{ max: 6600, min: 6500 }],
      },
      explanation:
        'Numerical questions can contain additional restrictions, like minimum and maximum values as well as display units. It is also possible to specify valid ranges, which are considered to be correct for graded and gamified settings, as well as a general explanation. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 4,
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: ctx.user.sub,
            name: 'Demo Tag',
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionNR.id, userId: ctx.user.sub },
    ctx.prisma
  )

  // create Free Text demo question
  const questionFT = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion FT',
      type: DB.ElementType.FREE_TEXT,
      content: 'Describe a main principle of a social market economy.',
      options: {
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        solutions: ['fair competition', 'private companies', 'balance'],
        restrictions: { maxLength: 150 },
      },
      explanation:
        'Free Text questions can contain additional restrictions, like a maximum length, as well as sample solutions for graded and gamified settings. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 4,
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: ctx.user.sub,
            name: 'Demo Tag',
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionFT.id, userId: ctx.user.sub },
    ctx.prisma
  )

  // create demo Flashcard
  const flashcard = await ctx.prisma.element.create({
    data: {
      name: 'Demo Flashcard',
      type: DB.ElementType.FLASHCARD,
      content: 'What is the main use case for Flashcards?',
      options: {},
      explanation:
        'Flashcards are a great way to learn educational content by heart. Both sides of the flashcard fully support LaTeX and Markdown syntax, as well as images.',
      pointsMultiplier: 1,
      owner: { connect: { id: ctx.user.sub } },
      tags: {
        connect: { ownerId_name: { ownerId: ctx.user.sub, name: 'Demo Tag' } },
      },
      basePoints: false,
    },
  })
  await recomputeDerivedPermissions(
    { elementId: flashcard.id, userId: ctx.user.sub },
    ctx.prisma
  )

  // create demo content element
  const contentElement = await ctx.prisma.element.create({
    data: {
      name: 'Demo Content Element',
      type: DB.ElementType.CONTENT,
      content:
        'Content elements are a great way to provide additional information to your students. They fully support LaTeX and Markdown syntax and allow to include images. You can also use them to recap relevant course content in asynchronous KlickerUZH elements before asking a series of questions.',
      options: {},
      owner: { connect: { id: ctx.user.sub } },
      tags: {
        connect: { ownerId_name: { ownerId: ctx.user.sub, name: 'Demo Tag' } },
      },
      basePoints: false,
    },
  })
  await recomputeDerivedPermissions(
    { elementId: contentElement.id, userId: ctx.user.sub },
    ctx.prisma
  )

  const { questionSE, questionCS } =
    await seedDemoSelectionAndCaseStudyElements(ctx)

  const blockData = [
    {
      questions: [questionSC, questionMC],
      timeLimit: 100,
      randomSelection: null,
    },
    {
      questions: [questionKPRIM, questionNR, questionFT],
      timeLimit: null,
      randomSelection: null,
    },
    {
      questions: [questionSC],
      timeLimit: 50,
      randomSelection: null,
    },
    {
      questions: [questionMC],
      timeLimit: 20,
      randomSelection: null,
    },
    {
      questions: [questionKPRIM],
      timeLimit: null,
      randomSelection: null,
    },
    {
      questions: [questionSE, questionCS],
      timeLimit: null,
      randomSelection: null,
    },
  ]

  const quizMultiplier = 2
  const liveQuiz = await ctx.prisma.liveQuiz.create({
    data: {
      name: 'Demo Live Quiz',
      displayName: 'Demo Live Quiz Display Name',
      description: 'Demo Live Quiz Description',
      pointsMultiplier: quizMultiplier,
      isGamificationEnabled: true,
      blocks: {
        create: blockData.map(
          ({ questions, randomSelection, timeLimit }, blockIx) => ({
            order: blockIx,
            timeLimit,
            randomSelection,
            elements: {
              create: questions.map((element, elementIx) => {
                const elementData = processElementData(element)
                const initialResults = getInitialInstanceResults(elementData)

                return {
                  order: elementIx,
                  type: DB.ElementInstanceType.LIVE_QUIZ,
                  elementType: element.type,
                  elementData,
                  options: {
                    pointsMultiplier: quizMultiplier * element.pointsMultiplier,
                    basePoints: element.basePoints,
                  },
                  results: initialResults,
                  anonymousResults: initialResults,
                  instanceStatistics: {
                    create: getInitialInstanceStatistics(
                      DB.ElementInstanceType.LIVE_QUIZ
                    ),
                  },
                  element: {
                    connect: {
                      id: element.id,
                    },
                  },
                  owner: {
                    connect: {
                      id: ctx.user.sub,
                    },
                  },
                }
              }),
            },
          })
        ),
      },
      owner: {
        connect: { id: ctx.user.sub },
      },
    },
    include: {
      blocks: true,
    },
  })
  await recomputeDerivedPermissions(
    { liveQuizId: liveQuiz.id, userId: ctx.user.sub },
    ctx.prisma
  )
}
