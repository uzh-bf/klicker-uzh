import * as DB from '@klicker-uzh/prisma/client'
import * as crypto from 'crypto'

export async function issueCredential({
  participantId,
  courseId,
  type,
  metadata,
  prisma,
}: {
  participantId: string
  courseId: string
  type: DB.CredentialType
  metadata: any
  prisma: DB.PrismaClient
}) {
  const token = crypto.randomBytes(32).toString('hex')

  return await prisma.verifiableCredential.create({
    data: {
      token,
      type,
      participantId,
      courseId,
      metadata,
    },
  })
}

export async function getCredentialByToken({
  token,
  prisma,
}: {
  token: string
  prisma: DB.PrismaClient
}) {
  return await prisma.verifiableCredential.findUnique({
    where: {
      token,
      isRevoked: false,
    },
    include: {
      course: true,
    },
  })
}

export async function getCourseCredentials({
  courseId,
  prisma,
}: {
  courseId: string
  prisma: DB.PrismaClient
}) {
  return await prisma.verifiableCredential.findMany({
    where: {
      courseId,
    },
    orderBy: {
      issuedAt: 'desc',
    },
  })
}

export async function revokeCredential({
  id,
  prisma,
}: {
  id: string
  prisma: DB.PrismaClient
}) {
  return await prisma.verifiableCredential.update({
    where: {
      id,
    },
    data: {
      isRevoked: true,
    },
  })
}
