import bcrypt from 'bcrypt'
import generatePassword from 'generate-password'
import JWT from 'jsonwebtoken'
import { Context } from '../lib/context'
const { normalizeEmail } = require('validator')

interface RegisterParticipantFromLTIArgs {
  participantId: string
  participantEmail: string
}

export async function registerParticipantFromLTI(
  { participantId, participantEmail }: RegisterParticipantFromLTIArgs,
  ctx: Context
): Promise<string> {
  let participant = await ctx.prisma.participantAccount.findFirst({
    where: {
      ssoType: 'LTI',
      ssoId: participantId,
    },
    include: {
      participant: true,
    },
  })

  const pseudonym = generatePassword.generate({
    length: 8,
    uppercase: true,
    symbols: false,
    numbers: true,
  })

  const salt = generatePassword.generate({
    length: 10,
    uppercase: true,
    symbols: true,
    numbers: true,
  })

  const password = generatePassword.generate({
    length: 10,
    uppercase: true,
    symbols: true,
    numbers: true,
  })

  const hash = bcrypt.hashSync(password, 10)

  const normalizedEmail = normalizeEmail(participantEmail)

  // if there is no participant matching the SSO id from LTI
  // create a new participant and participant account
  if (!participant) {
    participant = await ctx.prisma.participantAccount.create({
      data: {
        ssoType: 'LTI',
        ssoId: participantId,
        participant: {
          create: {
            email: normalizedEmail,
            password: hash,
            pseudonym,
            salt,
          },
        },
      },
      include: {
        participant: true,
      },
    })
  }

  const jwt = JWT.sign(
    {
      sub: participant?.participant.id,
      role: 'PARTICIPANT',
    },
    'abcd',
    {
      algorithm: 'HS256',
      expiresIn: '1w',
    }
  )

  ctx.res.cookie('jwt', jwt, {
    domain: process.env.API_DOMAIN ?? 'localhost',
    path: '/api/graphql',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    // secure: !isDev && APP_CFG.https,
  })

  return participant.id
}
