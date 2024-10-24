import * as DB from '@klicker-uzh/prisma'
import { Locale, UserLoginScope, UserRole } from '@klicker-uzh/prisma'
import { DisplayMode } from '@klicker-uzh/types'
import { processQuestionData } from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import dayjs from 'dayjs'
import type { CookieOptions } from 'express'
import JWT from 'jsonwebtoken'
import type { Context, ContextWithUser } from '../lib/context.js'
import { prepareInitialQuestionInstanceResults } from '../lib/questions.js'
import { sendTeamsNotifications } from '../lib/util.js'
import * as EmailService from '../services/email.js'

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

interface LoginUserTokenArgs {
  shortname: string
  token: string
}

export async function loginUserToken(
  { shortname, token }: LoginUserTokenArgs,
  ctx: Context
) {
  const user = await ctx.prisma.user.findUnique({
    where: { shortname: shortname.trim() },
  })

  if (!user) {
    await sendTeamsNotifications(
      'graphql/loginUserToken',
      `LOGIN FAILED: User with shortname ${shortname} not found.`
    )
    return null
  }

  const isLoginValid =
    token === user.loginToken &&
    dayjs(user.loginTokenExpiresAt).isAfter(dayjs())

  if (!isLoginValid) return null

  ctx.prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const jwt = JWT.sign(
    {
      sub: user.id,
      role: user.role,
      scope: UserLoginScope.SESSION_EXEC,
    },
    // TODO: use structured configuration approach
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '4w',
    }
  )

  ctx.res.cookie('next-auth.session-token', jwt, {
    ...COOKIE_SETTINGS,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  })

  ctx.res.cookie('NEXT_LOCALE', user.locale, COOKIE_SETTINGS)

  return user.id
}

export async function logoutUser(_: any, ctx: ContextWithUser) {
  ctx.res.cookie('next-auth.session-token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  return ctx.user.sub
}

export function createParticipantToken(participantId: string) {
  return JWT.sign(
    {
      sub: participantId,
      role: UserRole.PARTICIPANT,
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

  const jwt = createParticipantToken(participantId)

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
  if (!participant) return null

  const isLoginValid = await bcrypt.compare(password, participant.password)

  if (!isLoginValid) return null

  await doParticipantLogin(
    {
      participantId: participant.id,
      participantLocale: participant.locale,
    },
    ctx
  )

  // TODO: return more data (e.g. Avatar etc.)
  return participant.id
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

  const magicLinkJWT = JWT.sign(
    {
      sub: participantData.id,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.OTP,
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '15 minutes',
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
  const tokenData = JWT.verify(token, process.env.APP_SECRET as string) as {
    sub: string
    scope: UserLoginScope
  }

  if (!tokenData.sub || tokenData.scope !== UserLoginScope.OTP) {
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
  const tokenData = JWT.verify(token, process.env.APP_SECRET as string) as {
    sub: string
    scope: UserLoginScope
  }

  if (!tokenData.sub || tokenData.scope !== UserLoginScope.ACTIVATION) {
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

export async function logoutParticipant(_: any, ctx: ContextWithUser) {
  ctx.res.cookie('participant_token', 'logoutString', {
    ...COOKIE_SETTINGS,
    maxAge: 0,
  })

  return ctx.user.sub
}

export async function generateLoginToken(ctx: ContextWithUser) {
  const expirationDate = dayjs().add(10, 'minute').toDate()
  const loginToken = Math.floor(
    100000000 + Math.random() * 900000000
  ).toString()

  const user = await ctx.prisma.user.update({
    where: { id: ctx.user.sub },
    data: { loginToken: loginToken, loginTokenExpiresAt: expirationDate },
  })

  return user
}

export async function getLoginToken(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
  })

  if (!user) return null

  if (
    !user.loginTokenExpiresAt ||
    dayjs(user.loginTokenExpiresAt).isBefore(dayjs())
  ) {
    return null
  }

  return user
}

interface ChangeUserLocaleArgs {
  locale: Locale
}

export async function changeUserLocale(
  { locale }: ChangeUserLocaleArgs,
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

interface ChangeParticipantLocaleArgs {
  locale: Locale
}

export async function changeParticipantLocale(
  { locale }: ChangeParticipantLocaleArgs,
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
      const ltiData = JWT.verify(
        signedLtiData,
        process.env.APP_SECRET as string
      ) as { email: string; sub: string; scope: 'LTI1.1' | 'LTI1.3' }
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

    const activationJWT = JWT.sign(
      {
        sub: participant.id,
        role: UserRole.PARTICIPANT,
        scope: UserLoginScope.ACTIVATION,
      },
      process.env.APP_SECRET as string,
      {
        algorithm: 'HS256',
        expiresIn: '60 minutes',
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
  const ltiData = JWT.verify(
    signedLtiData,
    process.env.APP_SECRET as string
  ) as {
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

  if (!account?.participant) return null

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

  if (!participant || participant.id === ctx.user?.sub) return true

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
  scope: UserLoginScope
}

export async function createUserLogin(
  { password, name, scope }: UserLoginProps,
  ctx: ContextWithUser
) {
  const hashedPassword = await bcrypt.hash(password, 12)
  const login = await ctx.prisma.userLogin.create({
    data: {
      password: hashedPassword,
      name: name.trim(),
      // scope,
      // TODO: allow creation of other access levels once auth is handled granularly
      scope: UserLoginScope.FULL_ACCESS,
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
  // check if the shortname is already taken
  const existingUser = await ctx.prisma.user.findUnique({
    where: { shortname: shortname.trim() },
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
    data: { shortname: shortname.trim() },
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
  }: { shortname: string; locale: Locale; sendUpdates: boolean },
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
  await seedDemoQuestions(ctx)

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

  // create Numerical demo question
  const questionNR = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion NR',
      type: DB.ElementType.NUMERICAL,
      content:
        'Estimate the length of the **longest** river in the world (answer in kilometres).',
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
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

  // create Free Text demo question
  const questionFT = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion FT',
      type: DB.ElementType.FREE_TEXT,
      content: 'Describe a main principle of a social market economy.',
      options: {
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
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

  // create demo Content Element
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

  await ctx.prisma.liveSession.create({
    data: {
      name: 'Demo Session',
      displayName: 'Demo Session Display Name',
      description: 'Demo Session Description',
      pointsMultiplier: 2,
      isGamificationEnabled: true,
      blocks: {
        create: blockData.map(
          ({ questions, randomSelection, timeLimit }, blockIx) => {
            const newInstances = questions.map((question, ix) => {
              const processedQuestionData = processQuestionData(question)
              return {
                order: ix,
                type: DB.QuestionInstanceType.SESSION,
                pointsMultiplier: 2 * question.pointsMultiplier,
                questionData: processedQuestionData!,
                results: prepareInitialQuestionInstanceResults(
                  processedQuestionData!
                ),
                question: {
                  connect: { id: question.id },
                },
                owner: {
                  connect: { id: ctx.user.sub },
                },
              }
            })

            return {
              order: blockIx,
              randomSelection,
              timeLimit,
              instances: {
                create: newInstances,
              },
            }
          }
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
}
