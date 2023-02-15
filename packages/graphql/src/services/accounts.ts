import { UserRole } from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import dayjs from 'dayjs'
import JWT from 'jsonwebtoken'
import isEmail from 'validator/lib/isEmail'
import normalizeEmail from 'validator/lib/normalizeEmail'
import { Context, ContextWithUser } from '../lib/context'

interface LoginUserArgs {
  email: string
  password: string
}

export async function loginUser(
  { email, password }: LoginUserArgs,
  ctx: Context
) {
  if (!isEmail(email)) return null

  const normalizedEmail = normalizeEmail(email) as string

  const user = await ctx.prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) return null
  if (!user.isActive) return null

  const isLoginValid = await bcrypt.compare(password, user.password)

  if (!isLoginValid) return null

  ctx.prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const jwt = JWT.sign(
    {
      sub: user.id,
      role: user.role,
    },
    // TODO: use structured configuration approach
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '2w',
    }
  )

  ctx.res.cookie('user_token', jwt, {
    domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
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
  })

  return user.id
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
  if (!user.isActive) return null

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
    },
    // TODO: use structured configuration approach
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '4w',
    }
  )

  ctx.res.cookie('user_token', jwt, {
    domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 27,
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_DOMAIN !== '127.0.0.1',
    sameSite:
      process.env.NODE_ENV === 'development' ||
      process.env.COOKIE_DOMAIN === '127.0.0.1'
        ? 'lax'
        : 'none',
  })

  return user.id
}

export async function logoutUser(_: any, ctx: ContextWithUser) {
  ctx.res.cookie('user_token', 'logoutString', {
    domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 0,
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_DOMAIN !== '127.0.0.1',
    sameSite:
      process.env.NODE_ENV === 'development' ||
      process.env.COOKIE_DOMAIN === '127.0.0.1'
        ? 'lax'
        : 'none',
  })

  return ctx.user.sub
}

export async function getUserProfile(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
  })

  return user
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

  ctx.res.cookie('participant_token', jwt, {
    domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
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
  })

  // TODO: return more data (e.g. Avatar etc.)
  return participant.id
}

export async function logoutParticipant(_: any, ctx: ContextWithUser) {
  ctx.res.cookie('participant_token', 'logoutString', {
    domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 0,
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_DOMAIN !== '127.0.0.1',
    sameSite:
      process.env.NODE_ENV === 'development' ||
      process.env.COOKIE_DOMAIN === '127.0.0.1'
        ? 'lax'
        : 'none',
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

export async function getLoginToken(_: any, ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
  })

  if (!user) return null

  if (
    !user.loginTokenExpiresAt ||
    dayjs(user.loginTokenExpiresAt).isBefore(dayjs())
  )
    return null

  return user
}
