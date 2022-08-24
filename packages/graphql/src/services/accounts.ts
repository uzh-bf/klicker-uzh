import { UserRole } from '@klicker-uzh/prisma'
import bcrypt from 'bcrypt'
import JWT from 'jsonwebtoken'
import isEmail from 'validator/lib/isEmail'
import normalizeEmail from 'validator/lib/normalizeEmail'
import { Context } from '../lib/context'

interface LoginUserArgs {
  email: string
  password: string
}

interface LoginParticipantArgs {
  username: string
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
      expiresIn: '1w',
    }
  )

  ctx.res.cookie('user_token', jwt, {
    domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  })

  return user.id
}

export async function loginParticipant(
  { username, password }: LoginParticipantArgs,
  ctx: Context
) {
  const participant = await ctx.prisma.participant.findUnique({
    where: { pseudonym: username },
  })

  if (!participant) return null

  const isLoginValid = await bcrypt.compare(password, participant.password)

  if (!isLoginValid) return null

  // TODO: Add back once DB table is updated
  // ctx.prisma.participant.update({
  //   where: { id: participant.id },
  //   data: { lastLoginAt: new Date() },
  // })

  const jwt = JWT.sign(
    {
      sub: participant.id,
      role: UserRole.PARTICIPANT,
    },
    // TODO: use structured configuration approach
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '6d',
    }
  )

  ctx.res.cookie('user_token', jwt, {
    domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 6,
    secure: process.env.NODE_ENV === 'production',
  })

  return participant.id
}
