import { Locale, UserLoginScope, UserRole } from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import dayjs from 'dayjs'
import { CookieOptions } from 'express'
import JWT from 'jsonwebtoken'
import isEmail from 'validator/lib/isEmail'
import normalizeEmail from 'validator/lib/normalizeEmail'
import { Context, ContextWithUser } from '../lib/context'

const COOKIE_SETTINGS: CookieOptions = {
  domain: process.env.COOKIE_DOMAIN,
  path: '/',
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24 * 13,
  secure:
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1',
  sameSite:
    process.env.NODE_ENV === 'development' ||
    process.env.COOKIE_DOMAIN === '127.0.0.1'
      ? 'lax'
      : 'none',
}

interface LoginUserTokenArgs {
  email: string
  token: string
}

export async function loginUserToken(
  { email, token }: LoginUserTokenArgs,
  ctx: Context
) {
  if (!isEmail(email)) return null

  const normalizedEmail = normalizeEmail(email) as string

  const user = await ctx.prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) return null

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
    maxAge: 1000 * 60 * 60 * 24 * 27,
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

interface LoginParticipantArgs {
  username: string
  password: string
}

export async function loginParticipant(
  { username, password }: LoginParticipantArgs,
  ctx: Context
) {
  const participant = await ctx.prisma.participant.findUnique({
    where: { username: username },
  })

  if (!participant) return null

  const isLoginValid = await bcrypt.compare(password, participant.password)

  if (!isLoginValid) return null

  ctx.prisma.participant.update({
    where: { id: participant.id },
    data: { lastLoginAt: new Date() },
  })

  const jwt = createParticipantToken(participant.id)

  ctx.res.cookie('participant_token', jwt, COOKIE_SETTINGS)

  ctx.res.cookie('NEXT_LOCALE', participant.locale, COOKIE_SETTINGS)

  // TODO: return more data (e.g. Avatar etc.)
  return participant.id
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
  })

  if (!participant) return false

  await ctx.prisma.participant.delete({
    where: { id: ctx.user.sub },
  })

  return true
}

interface CreateParticipantAccountArgs {
  email: string
  username: string
  password: string
  isProfilePublic: boolean
  signedLtiData?: string | null
}

export async function createParticipantAccount(
  {
    email,
    isProfilePublic,
    username,
    password,
    signedLtiData,
  }: CreateParticipantAccountArgs,
  ctx: Context
) {
  if (signedLtiData) {
    try {
      const ltiData = JWT.verify(
        signedLtiData,
        process.env.APP_SECRET as string
      ) as { email: string; sub: string }

      const account = await ctx.prisma.participantAccount.create({
        data: {
          ssoId: ltiData.sub,
          participant: {
            create: {
              email: ltiData.email,
              username,
              password: await bcrypt.hash(password, 10),
              isEmailValid: true,
              isProfilePublic,
              isSSOAccount: true,
              lastLoginAt: new Date(),
            },
          },
        },
        include: {
          participant: true,
        },
      })

      const jwt = createParticipantToken(account.participant.id)

      ctx.res.cookie('participant_token', jwt, COOKIE_SETTINGS)

      ctx.res.cookie('NEXT_LOCALE', account.participant.locale, COOKIE_SETTINGS)

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
    const participant = await ctx.prisma.participant.create({
      data: {
        email,
        username,
        password: await bcrypt.hash(password, 10),
        isEmailValid: false,
        isProfilePublic,
        isSSOAccount: false,
        lastLoginAt: new Date(),
      },
    })

    const jwt = createParticipantToken(participant.id)

    ctx.res.cookie('participant_token', jwt, COOKIE_SETTINGS)

    ctx.res.cookie('NEXT_LOCALE', participant.locale, COOKIE_SETTINGS)

    return {
      participant,
      participantToken: jwt,
    }
  } catch (e) {
    console.error(e)
    return null
  }
}

interface LoginParticipantWithLtiArgs {
  signedLtiData: string
}

export async function loginParticipantWithLti(
  { signedLtiData }: LoginParticipantWithLtiArgs,
  ctx: Context
) {
  const ltiData = JWT.verify(signedLtiData, process.env.APP_SECRET as string)

  const account = await ctx.prisma.participantAccount.findUnique({
    where: { ssoId: ltiData.sub as string },
    include: {
      participant: true,
    },
  })

  if (!account?.participant) return null

  const jwt = createParticipantToken(account.participant.id)

  ctx.res.cookie('participant_token', jwt, COOKIE_SETTINGS)

  ctx.res.cookie('NEXT_LOCALE', account.participant.locale, COOKIE_SETTINGS)

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
      name,
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
  const user = await ctx.prisma.user.update({
    where: { id: ctx.user.sub },
    data: { shortname },
  })

  return user
}

export async function changeInitialSettings(
  { shortname, locale }: { shortname: string; locale: Locale },
  ctx: ContextWithUser
) {
  const existingUser = await ctx.prisma.user.findFirst({
    where: { shortname },
  })

  console.log('query user id: ', ctx.user.sub)
  console.log('Found user with same shortname: ', existingUser)

  if (existingUser && existingUser.id !== ctx.user.sub) {
    // another user already uses the shortname this user wants
    const user = await ctx.prisma.user.update({
      where: { id: ctx.user.sub },
      data: { locale },
    })
    return user
  }

  const user = await ctx.prisma.user.update({
    where: { id: ctx.user.sub },
    data: { shortname, locale, firstLogin: false },
  })

  return user
}
