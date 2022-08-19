import { SSOType, UserRole } from '@klicker-uzh/prisma'
import generatePassword from 'generate-password'
import JWT from 'jsonwebtoken'
import { Context } from '../lib/context'
import { generatePasswordHash } from '../lib/crypto'
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
      ssoType: SSOType.LTI,
      ssoId: participantId,
    },
    include: {
      participant: true,
    },
  })

  // if there is no participant matching the SSO id from LTI
  // create a new participant and participant account
  if (!participant) {
    // generate a random pseudonym/username that can be changed later on
    const pseudonym = generatePassword.generate({
      length: 8,
      uppercase: true,
      symbols: false,
      numbers: true,
    })

    // generate a random password that can be changed later on
    const password = generatePassword.generate({
      length: 16,
      uppercase: true,
      symbols: true,
      numbers: true,
    })

    const { hash, salt } = generatePasswordHash(password)

    // normalize the email address to remove any ambiguity
    const normalizedEmail = normalizeEmail(participantEmail)

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
      role: UserRole.PARTICIPANT,
    },
    'abcd',
    {
      algorithm: 'HS256',
      expiresIn: '1w',
    }
  )

  ctx.res.cookie('participant_token', jwt, {
    domain: process.env.API_DOMAIN ?? 'localhost',
    path: '/api/graphql',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    // secure: !isDev && APP_CFG.https,
  })

  return participant.id
}
