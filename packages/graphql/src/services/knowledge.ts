import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

async function getOwnedKbOrThrow(ctx: ContextWithUser, id: string) {
  const kb = await ctx.prisma.kB.findUnique({ where: { id } })
  if (!kb || kb.ownerId !== ctx.user.sub) {
    throw new GraphQLError('KB not found')
  }
  return kb
}

export async function getUserKbs(ctx: ContextWithUser) {
  return ctx.prisma.kB.findMany({
    where: { ownerId: ctx.user.sub },
    include: {
      resources: { orderBy: { updatedAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getKb({ id }: { id: string }, ctx: ContextWithUser) {
  await getOwnedKbOrThrow(ctx, id)

  return ctx.prisma.kB.findUniqueOrThrow({
    where: { id },
    include: {
      resources: { orderBy: { updatedAt: 'desc' } },
    },
  })
}

export async function createKb(
  {
    name,
    description,
  }: {
    name: string
    description?: string | null
  },
  ctx: ContextWithUser
) {
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new GraphQLError('KB name is required')
  }

  return ctx.prisma.kB.create({
    data: {
      name: normalizedName,
      description,
      ownerId: ctx.user.sub,
    },
    include: { resources: true },
  })
}

export async function deleteKb({ id }: { id: string }, ctx: ContextWithUser) {
  await getOwnedKbOrThrow(ctx, id)

  return ctx.prisma.kB.delete({
    where: { id },
    include: { resources: true },
  })
}
