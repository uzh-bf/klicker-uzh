import * as DB from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import {
  AuditClient,
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  processElementData,
  recomputeDerivedPermissions,
  signJWT,
  verifyJWT,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import type { CookieOptions } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { sendTeamsNotifications } from '../lib/util.js'
import * as EmailService from '../services/email.js'

// Initialize audit client for authentication event logging
const auditClient = new AuditClient()

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

  // Log user logout event
  await auditClient.log({
    tenantId: 'klicker-uzh', // TODO: get from context when multi-tenant support is added
    subject: `user:${ctx.user.email || ctx.user.sub}`,
    action: 'auth.user.logout',
    userId: ctx.user.sub,
    attributes: {
      method: 'session_cookie_clear',
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
      userRole: ctx.user.role,
    }
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
  const participantWithEmail = await ctx.prisma.participant.findUnique({
    where: { email: usernameOrEmail.trim().toLowerCase() },
  })

  const participant = participantWithUsername || participantWithEmail
  
  // Log failed login attempt - participant not found
  if (!participant) {
    await auditClient.log({
      tenantId: 'klicker-uzh', // TODO: get from context when multi-tenant support is added
      subject: `participant:${usernameOrEmail}`,
      action: 'auth.participant.login.failed',
      attributes: {
        method: 'password',
        reason: 'user_not_found',
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
    return null
  }

  const isLoginValid = await bcrypt.compare(password, participant.password)

  // Log failed login attempt - invalid password
  if (!isLoginValid) {
    await auditClient.log({
      tenantId: 'klicker-uzh', // TODO: get from context when multi-tenant support is added
      subject: `participant:${participant.username || participant.email}`,
      action: 'auth.participant.login.failed',
      userId: participant.id,
      attributes: {
        method: 'password',
        reason: 'invalid_password',
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
    return null
  }

  await doParticipantLogin(
    {
      participantId: participant.id,
      participantLocale: participant.locale,
    },
    ctx
  )

  // Log successful login attempt
  await auditClient.log({
    tenantId: 'klicker-uzh', // TODO: get from context when multi-tenant support is added
    subject: `participant:${participant.username || participant.email}`,
    action: 'auth.participant.login.success',
    userId: participant.id,
    attributes: {
      method: 'password',
      participantId: participant.id,
      locale: participant.locale,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
      lastLoginAt: participant.lastLoginAt?.toISOString(),
    }
  })

  // TODO: return more data (e.g. Avatar etc.)
  return participant.id
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
    await auditClient.log({
      tenantId: 'klicker-uzh',
      subject: `temp-participant:${pseudonym}`,
      action: 'auth.temporary.login.failed',
      sessionId: liveQuizId,
      attributes: {
        method: 'temporary',
        reason: 'quiz_not_found_or_not_published',
        liveQuizId,
        pseudonym: pseudonym.trim(),
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
    return null
  }

  // verify that no other participant or temporary participant in this live quiz exists with the same pseudonym
  const existingParticipant = await ctx.prisma.participant.findFirst({
    where: { username: pseudonym.trim() },
  })

  if (existingParticipant) {
    await auditClient.log({
      tenantId: 'klicker-uzh',
      subject: `temp-participant:${pseudonym}`,
      action: 'auth.temporary.login.failed',
      sessionId: liveQuizId,
      attributes: {
        method: 'temporary',
        reason: 'pseudonym_taken_by_participant',
        liveQuizId,
        pseudonym: pseudonym.trim(),
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
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
    await auditClient.log({
      tenantId: 'klicker-uzh',
      subject: `temp-participant:${pseudonym}`,
      action: 'auth.temporary.login.failed',
      sessionId: liveQuizId,
      attributes: {
        method: 'temporary',
        reason: 'pseudonym_taken_by_temporary_participant',
        liveQuizId,
        pseudonym: pseudonym.trim(),
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
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

  // Log successful temporary participant login
  await auditClient.log({
    tenantId: 'klicker-uzh',
    subject: `temp-participant:${pseudonym}`,
    action: 'auth.temporary.login.success',
    sessionId: liveQuizId,
    userId: temporaryParticipant.id,
    attributes: {
      method: 'temporary',
      liveQuizId,
      pseudonym: pseudonym.trim(),
      avatar: avatar || null,
      temporaryParticipantId: temporaryParticipant.id,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
    }
  })

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
    }
  )

  const magicLink = `${
    process.env.NODE_ENV === 'production' ? 'https' : 'http'
  }://${process.env.APP_STUDENT_DOMAIN}/magicLogin?token=${magicLinkJWT}`

  const emailHtml = await EmailService.hydrateTemplate(
    {
      templateName: 'MagicLinkRequested',
      variables: { LINK: magicLink },
    },
    ctx
  )

  if (!emailHtml) return null

  await sendTeamsNotifications(
    'graphql/sendMagicLink',
    `One-time login token created for ${usernameOrEmail}: ${magicLink}`
  )

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
    await auditClient.log({
      tenantId: 'klicker-uzh',
      subject: `participant:unknown`,
      action: 'auth.magiclink.login.failed',
      attributes: {
        method: 'magic_link',
        reason: 'invalid_token_or_scope',
        tokenValid: !!tokenData.sub,
        scopeValid: tokenData.scope === DB.UserLoginScope.OTP,
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
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

    // Log successful magic link login
    await auditClient.log({
      tenantId: 'klicker-uzh',
      subject: `participant:${participant.username || participant.email}`,
      action: 'auth.magiclink.login.success',
      userId: participant.id,
      attributes: {
        method: 'magic_link',
        participantId: participant.id,
        locale: participant.locale,
        tokenUsed: true,
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
        lastLoginAt: participant.lastLoginAt?.toISOString(),
      }
    })

    return participant.id
  }

  // Log failed login - participant not found
  await auditClient.log({
    tenantId: 'klicker-uzh',
    subject: `participant:${tokenData.sub}`,
    action: 'auth.magiclink.login.failed',
    userId: tokenData.sub,
    attributes: {
      method: 'magic_link',
      reason: 'participant_not_found',
      tokenSubject: tokenData.sub,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
    }
  })

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
  ctx.res.cookie('participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  // Log participant logout event
  await auditClient.log({
    tenantId: 'klicker-uzh',
    subject: `participant:${ctx.user.email || ctx.user.sub}`,
    action: 'auth.participant.logout',
    userId: ctx.user.sub,
    attributes: {
      method: 'session_cookie_clear',
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
      userRole: ctx.user.role,
    }
  })

  return ctx.user.sub
}

export async function logoutTemporaryParticipant(
  { liveQuizId }: { liveQuizId: string },
  ctx: ContextWithUser
) {
  // verify that the requesting user is a temporary participant
  if (ctx.user.role !== DB.UserRole.TEMPORARY_PARTICIPANT) {
    await auditClient.log({
      tenantId: 'klicker-uzh',
      subject: `user:${ctx.user.email || ctx.user.sub}`,
      action: 'auth.temporary.logout.failed',
      userId: ctx.user.sub,
      attributes: {
        method: 'temporary',
        reason: 'not_temporary_participant',
        userRole: ctx.user.role,
        liveQuizId,
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
    return false // not a temporary participant
  }

  // check if there exists a temporary leaderboard entry for the current user
  const lbEntry = await ctx.prisma.temporaryLeaderboardEntry.findUnique({
    where: { id: ctx.user.sub, quizId: liveQuizId },
  })

  if (!lbEntry) {
    await auditClient.log({
      tenantId: 'klicker-uzh',
      subject: `temp-participant:${ctx.user.sub}`,
      action: 'auth.temporary.logout.failed',
      userId: ctx.user.sub,
      attributes: {
        method: 'temporary',
        reason: 'leaderboard_entry_not_found',
        liveQuizId,
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
    return false // no temporary participant found
  }

  // delete the temporary leaderboard entry
  await ctx.prisma.temporaryLeaderboardEntry.delete({
    where: { id: ctx.user.sub, quizId: liveQuizId },
  })

  // delete the cookie
  ctx.res.cookie('temporary_participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  // Log successful temporary participant logout
  await auditClient.log({
    tenantId: 'klicker-uzh',
    subject: `temp-participant:${lbEntry.username}`,
    action: 'auth.temporary.logout.success',
    userId: ctx.user.sub,
    sessionId: liveQuizId,
    attributes: {
      method: 'temporary',
      liveQuizId,
      temporaryParticipantId: ctx.user.sub,
      username: lbEntry.username,
      score: lbEntry.score,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
    }
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
  await sendTeamsNotifications(
    'graphql/grantPrivatePreviewAccess',
    `User ${newUser.shortname} (${newUser.email}) granted private preview access`
  )

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
  if (signedLtiData) {
    const account = await ctx.prisma.$transaction(async (prisma) => {
      const ltiData = (await verifyJWT(
        signedLtiData,
        process.env.APP_SECRET as string
      )) as { email: string; sub: string; scope: 'LTI1.1' | 'LTI1.3' }
      // check if the username is already taken by another user
      const existingUser = await prisma.participant.findMany({
        where: {
          OR: [{ username: username.trim() }, { email: ltiData.email }],
        },
      })

      if (existingUser.length > 0) {
        // another user already uses the requested username or email, returning old user
        return null
      }

      const account = await prisma.participantAccount.create({
        data: {
          ssoId: ltiData.sub,
          ssoType: ltiData.scope,
          participant: {
            connectOrCreate: {
              where: {
                email: ltiData.email.toLowerCase(),
              },
              create: {
                email: ltiData.email.toLowerCase(),
                username: username.trim(),
                password: await bcrypt.hash(password, 10),
                isEmailValid: true,
                isProfilePublic,
                isSSOAccount: true,
                lastLoginAt: new Date(),
              },
            },
          },
        },
        include: {
          participant: true,
        },
      })

      // if a courseId is specified, add a participation in the corresponding course
      if (courseId) {
        await prisma.participation.upsert({
          where: {
            courseId_participantId: {
              courseId,
              participantId: account.participant.id,
            },
          },
          create: {
            course: {
              connect: {
                id: courseId,
              },
            },
            participant: {
              connect: {
                id: account.participant.id,
              },
            },
          },
          update: {},
        })
      }

      return account
    })

    if (!account) return null

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

  try {
    const participant = await ctx.prisma.$transaction(async (prisma) => {
      const participant = await prisma.participant.create({
        data: {
          email: email.trim().toLowerCase(),
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
            course: {
              connect: {
                id: courseId,
              },
            },
            participant: {
              connect: {
                id: participant.id,
              },
            },
          },
          update: {},
        })
      }

      return participant
    })

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
      }
    )

    const activationLink = `${
      process.env.NODE_ENV === 'production' ? 'https' : 'http'
    }://${process.env.APP_STUDENT_DOMAIN}/activation?token=${activationJWT}`

    const emailHtml = await EmailService.hydrateTemplate(
      {
        templateName: 'ParticipantAccountActivation',
        variables: { LINK: activationLink },
      },
      ctx
    )

    if (!emailHtml) return null

    await sendTeamsNotifications(
      'graphql/createParticipantAccount',
      `New participant account created: ${participant.email} with activation link ${activationLink}`
    )

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
    await sendTeamsNotifications(
      'graphql/createParticipantAccount',
      `Failed to create participant account: ${email} with error: ${
        e || 'missing'
      }`
    )

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
  const ltiData = (await verifyJWT(
    signedLtiData,
    process.env.APP_SECRET as string
  )) as {
    sub: string
    email?: string
    scope: string
  }

  console.log('ltiData', ltiData)

  let account = await ctx.prisma.participantAccount.findUnique({
    where: { ssoId: ltiData.sub as string },
    include: {
      participant: true,
    },
  })

  console.log('account', account)

  // check if there is a participant account already given the email address
  // if so, create a new participant account with the LTI data and new sub
  if (!account && ltiData.email) {
    const existingParticipant = await ctx.prisma.participant.findUnique({
      where: { email: ltiData.email },
    })

    console.log('existingParticipant', existingParticipant)

    if (!existingParticipant) {
      await auditClient.log({
        tenantId: 'klicker-uzh',
        subject: `participant:${ltiData.email}`,
        action: 'auth.lti.login.failed',
        attributes: {
          method: 'lti',
          reason: 'participant_not_found_by_email',
          ltiSubject: ltiData.sub,
          email: ltiData.email,
          ltiScope: ltiData.scope,
          courseId,
          ip: ctx.req?.ip,
          userAgent: ctx.req?.headers?.['user-agent'],
        }
      })
      return null
    }

    account = await ctx.prisma.participantAccount.create({
      data: {
        ssoId: ltiData.sub,
        ssoType: ltiData.scope,
        participant: {
          connect: {
            id: existingParticipant.id,
          },
        },
      },
      include: {
        participant: true,
      },
    })
  }

  if (!account?.participant) {
    await auditClient.log({
      tenantId: 'klicker-uzh',
      subject: `participant:${ltiData.email || ltiData.sub}`,
      action: 'auth.lti.login.failed',
      attributes: {
        method: 'lti',
        reason: 'no_participant_account_found',
        ltiSubject: ltiData.sub,
        email: ltiData.email,
        ltiScope: ltiData.scope,
        courseId,
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    })
    return null
  }

  if (courseId) {
    const participation = await ctx.prisma.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId: account.participant.id,
        },
      },
      create: {
        course: {
          connect: {
            id: courseId,
          },
        },
        participant: {
          connect: {
            id: account.participant.id,
          },
        },
      },
      update: {},
    })

    console.log('participation', participation)
  }

  const jwt = await doParticipantLogin(
    {
      participantId: account.participant.id,
      participantLocale: account.participant.locale,
    },
    ctx
  )

  // Log successful LTI login
  await auditClient.log({
    tenantId: 'klicker-uzh',
    subject: `participant:${account.participant.username || account.participant.email}`,
    action: 'auth.lti.login.success',
    userId: account.participant.id,
    attributes: {
      method: 'lti',
      participantId: account.participant.id,
      ltiSubject: ltiData.sub,
      ltiScope: ltiData.scope,
      email: ltiData.email,
      courseId,
      participationCreated: !!courseId,
      locale: account.participant.locale,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
      lastLoginAt: account.participant.lastLoginAt?.toISOString(),
    }
  })

  return {
    participant: account.participant,
    participantToken: jwt,
  }
}

export async function getUserLogins(ctx: ContextWithUser) {
  const logins = await ctx.prisma.userLogin.findMany({
    where: {
      user: {
        id: ctx.user.sub,
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      scope: 'asc',
    },
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
    { elementId: contentElement.id, userId: ctx.user.sub },
    ctx.prisma
  )

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
