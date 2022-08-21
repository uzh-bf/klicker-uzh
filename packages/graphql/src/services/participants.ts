import { SSOType, UserRole } from '@klicker-uzh/prisma'
import bcrypt from 'bcrypt'
import generatePassword from 'generate-password'
import JWT from 'jsonwebtoken'
import isEmail from 'validator/lib/isEmail'
import normalizeEmail from 'validator/lib/normalizeEmail'
import { Context } from '../lib/context'

interface GetCourseOverviewDataArgs {
  courseId: string
}

export async function getCourseOverviewData(
  { courseId }: GetCourseOverviewDataArgs,
  ctx: Context
) {
  if (ctx.user.sub) {
    const participation = await ctx.prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId: ctx.user.sub,
        },
      },
      include: {
        course: true,
        participant: true,
      },
    })

    if (participation) {
      return participation
    }
  }

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
  })

  if (!course) return null

  let participant = null
  if (ctx.user.sub) {
    participant = await ctx.prisma.participant.findUnique({
      where: { id: ctx.user.sub },
    })
  }

  return {
    participation: null,
    course,
    participant,
  }
}

interface RegisterParticipantFromLTIArgs {
  courseId: string
  participantId: string
  participantEmail: string
}

export async function registerParticipantFromLTI(
  { courseId, participantId, participantEmail }: RegisterParticipantFromLTIArgs,
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({ where: { id: courseId } })

  if (!course) return null

  let participant = await ctx.prisma.participantAccount.findFirst({
    where: {
      ssoType: SSOType.LTI,
      ssoId: participantId,
    },
    include: {
      participant: true,
    },
  })

  let participation = null

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

    const hash = await bcrypt.hash(password, 12)

    if (!isEmail(participantEmail)) {
      return null
    }

    // normalize the email address to remove any ambiguity
    const normalizedEmail = normalizeEmail(participantEmail) as string

    participant = await ctx.prisma.participantAccount.create({
      data: {
        ssoType: SSOType.LTI,
        ssoId: participantId,
        participant: {
          create: {
            email: normalizedEmail,
            password: hash,
            pseudonym,
          },
        },
      },
      include: {
        participant: true,
      },
    })
  } else {
    participation = await ctx.prisma.participation.findFirst({
      where: {
        courseId,
        participantId: participant.participantId,
      },
    })
  }

  const jwt = JWT.sign(
    {
      sub: participant?.participant.id,
      role: UserRole.PARTICIPANT,
    },
    // TODO: use structured configuration approach
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '1w',
    }
  )

  return {
    participantToken: jwt,
    participant: participant.participant,
    participation,
    course,
  }
}
