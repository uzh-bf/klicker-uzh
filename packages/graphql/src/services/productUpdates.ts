import * as DB from '@klicker-uzh/prisma/client'
import { PRODUCT_UPDATES } from '@klicker-uzh/product-updates'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

// The two actor tables carry the same state columns and differ only in their
// foreign key, so every resolver returns this common subset.
export interface ProductUpdateState {
  id: number
  updateId: string
  firstPresentedAt: Date
  lastPresentedAt: Date
  presentationCount: number
  readAt: Date | null
  dismissedAt: Date | null
}

type ProductUpdateActor =
  | { type: 'user'; id: string }
  | { type: 'participant'; id: string }

const KNOWN_UPDATE_IDS = new Set(PRODUCT_UPDATES.map((update) => update.id))

// The actor is derived from the authenticated session only; no resolver takes
// an actor id from the caller. Temporary and anonymous live-quiz participants
// are excluded from the subsystem entirely, so they are rejected here rather
// than silently getting an empty result.
function resolveActor(ctx: ContextWithUser): ProductUpdateActor {
  switch (ctx.user.role) {
    case DB.UserRole.USER:
    case DB.UserRole.ADMIN:
      return { type: 'user', id: ctx.user.sub }

    case DB.UserRole.PARTICIPANT:
      return { type: 'participant', id: ctx.user.sub }

    default:
      throw new GraphQLError(
        'This account type does not receive product updates'
      )
  }
}

// `updateId` has no foreign key because the catalog lives in code, so an
// unknown id would otherwise create an orphaned row that no surface can ever
// display or clean up.
function assertKnownUpdateIds(updateIds: string[]) {
  const unknownIds = updateIds.filter((id) => !KNOWN_UPDATE_IDS.has(id))

  if (unknownIds.length > 0) {
    throw new GraphQLError(
      `Unknown product update id(s): ${unknownIds.join(', ')}`
    )
  }
}

function findState(
  actor: ProductUpdateActor,
  updateId: string,
  ctx: ContextWithUser
): Promise<ProductUpdateState | null> {
  if (actor.type === 'user') {
    return ctx.prisma.userProductUpdateState.findUnique({
      where: { userId_updateId: { userId: actor.id, updateId } },
    })
  }

  return ctx.prisma.participantProductUpdateState.findUnique({
    where: { participantId_updateId: { participantId: actor.id, updateId } },
  })
}

// A row can be created by a read or a dismissal that arrives before any
// presentation was recorded. The presentation timestamps are not nullable, so
// they are filled with the moment the entry demonstrably reached the actor,
// while `presentationCount` keeps counting explicit presentations only.
function createState(
  actor: ProductUpdateActor,
  updateId: string,
  data: { readAt?: Date; dismissedAt?: Date },
  now: Date,
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  const state = {
    updateId,
    firstPresentedAt: now,
    lastPresentedAt: now,
    ...data,
  }

  if (actor.type === 'user') {
    return ctx.prisma.userProductUpdateState.create({
      data: { ...state, userId: actor.id },
    })
  }

  return ctx.prisma.participantProductUpdateState.create({
    data: { ...state, participantId: actor.id },
  })
}

function updateState(
  actor: ProductUpdateActor,
  updateId: string,
  data: { readAt?: Date; dismissedAt?: Date },
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  if (actor.type === 'user') {
    return ctx.prisma.userProductUpdateState.update({
      where: { userId_updateId: { userId: actor.id, updateId } },
      data,
    })
  }

  return ctx.prisma.participantProductUpdateState.update({
    where: { participantId_updateId: { participantId: actor.id, updateId } },
    data,
  })
}

interface GetProductUpdateStatesArgs {
  updateIds: string[]
}

export async function getProductUpdateStates(
  { updateIds }: GetProductUpdateStatesArgs,
  ctx: ContextWithUser
): Promise<ProductUpdateState[]> {
  const actor = resolveActor(ctx)
  assertKnownUpdateIds(updateIds)

  // Entries the actor has never interacted with have no row; the caller treats
  // a missing entry as unread and never presented.
  if (actor.type === 'user') {
    return ctx.prisma.userProductUpdateState.findMany({
      where: { userId: actor.id, updateId: { in: updateIds } },
    })
  }

  return ctx.prisma.participantProductUpdateState.findMany({
    where: { participantId: actor.id, updateId: { in: updateIds } },
  })
}

interface ProductUpdateStateArgs {
  updateId: string
}

export async function markProductUpdateRead(
  { updateId }: ProductUpdateStateArgs,
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  const actor = resolveActor(ctx)
  assertKnownUpdateIds([updateId])

  const now = new Date()
  const existingState = await findState(actor, updateId, ctx)

  if (!existingState) {
    return createState(actor, updateId, { readAt: now }, now, ctx)
  }

  // `readAt` records when the entry was first read, so a second read of the
  // same card must not move it.
  if (existingState.readAt) {
    return existingState
  }

  return updateState(actor, updateId, { readAt: now }, ctx)
}

export async function dismissProductUpdate(
  { updateId }: ProductUpdateStateArgs,
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  const actor = resolveActor(ctx)
  assertKnownUpdateIds([updateId])

  const now = new Date()
  const existingState = await findState(actor, updateId, ctx)

  if (!existingState) {
    return createState(actor, updateId, { dismissedAt: now }, now, ctx)
  }

  if (existingState.dismissedAt) {
    return existingState
  }

  return updateState(actor, updateId, { dismissedAt: now }, ctx)
}

export async function recordProductUpdatePresentation(
  { updateId }: ProductUpdateStateArgs,
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  const actor = resolveActor(ctx)
  assertKnownUpdateIds([updateId])

  const now = new Date()

  // The spotlight caps depend on this counter, so the increment has to survive
  // concurrent presentations in two tabs: upsert plus `increment` keeps it in
  // one statement instead of read-modify-write.
  if (actor.type === 'user') {
    return ctx.prisma.userProductUpdateState.upsert({
      where: { userId_updateId: { userId: actor.id, updateId } },
      create: {
        updateId,
        userId: actor.id,
        firstPresentedAt: now,
        lastPresentedAt: now,
        presentationCount: 1,
      },
      update: {
        lastPresentedAt: now,
        presentationCount: { increment: 1 },
      },
    })
  }

  return ctx.prisma.participantProductUpdateState.upsert({
    where: { participantId_updateId: { participantId: actor.id, updateId } },
    create: {
      updateId,
      participantId: actor.id,
      firstPresentedAt: now,
      lastPresentedAt: now,
      presentationCount: 1,
    },
    update: {
      lastPresentedAt: now,
      presentationCount: { increment: 1 },
    },
  })
}
