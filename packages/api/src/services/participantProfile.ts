import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const emailSchema = z.string().email()

const participantProfileSelect = {
  id: true,
  username: true,
  email: true,
  isProfilePublic: true,
} satisfies Prisma.ParticipantSelect

const participantAvatarSelect = {
  avatar: true,
  avatarSettings: true,
} satisfies Prisma.ParticipantSelect

type AvatarSettings = {
  skinTone: string
  eyes: string
  mouth: string
  hair: string
  facialHair: string
  accessory: string
  hairColor: string
  clothing: string
  clothingColor: string
}

export async function checkParticipantNameAvailable({
  participantId,
  prisma,
  username,
}: {
  participantId?: string
  prisma: PrismaClient
  username: string
}) {
  const participant = await prisma.participant.findUnique({
    where: { username: username.trim() },
    select: { id: true },
  })

  return !participant || participant.id === participantId
}

export async function updateParticipantProfile({
  email,
  isProfilePublic,
  participantId,
  password,
  prisma,
  username,
}: {
  email: string | null
  isProfilePublic?: boolean | null
  participantId: string
  password?: string | null
  prisma: PrismaClient
  username: string | null
}) {
  if (typeof username === 'string') {
    if (username.length < 5 || username.length > 15) {
      return null
    }
  }

  if (typeof email === 'string' && !emailSchema.safeParse(email).success) {
    return null
  }

  if (username) {
    const existingParticipant = await prisma.participant.findUnique({
      where: { username: username.trim() },
      select: { id: true },
    })

    if (existingParticipant && existingParticipant.id !== participantId) {
      return null
    }
  }

  const data: Prisma.ParticipantUpdateInput = {
    isProfilePublic:
      typeof isProfilePublic === 'boolean' ? isProfilePublic : undefined,
    email: email?.toLowerCase(),
    username: username?.trim() ?? undefined,
  }

  if (typeof password === 'string') {
    if (password.length < 8) {
      return null
    }

    data.password = await bcrypt.hash(password, 12)
  }

  return prisma.participant.update({
    where: { id: participantId },
    data,
    select: participantProfileSelect,
  })
}

export async function updateParticipantAvatar({
  avatar,
  avatarSettings,
  participantId,
  prisma,
}: {
  avatar: string | null
  avatarSettings: AvatarSettings
  participantId: string
  prisma: PrismaClient
}) {
  return prisma.participant.update({
    where: { id: participantId },
    data: {
      avatar: avatar ?? undefined,
      avatarSettings: avatarSettings as Prisma.InputJsonValue,
    },
    select: participantAvatarSelect,
  })
}
