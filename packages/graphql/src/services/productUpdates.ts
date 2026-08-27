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

// Writes follow the repository's scope floor for mutations: a delegated
// lecturer login that may only read or run a live quiz can see its own state
// but not change it. Participant tokens carry no scope claim at all, so the
// floor applies to lecturer sessions only.
function resolveWritingActor(ctx: ContextWithUser): ProductUpdateActor {
  const actor = resolveActor(ctx)

  if (
    actor.type === 'user' &&
    ctx.user.scope !== DB.UserLoginScope.ACCOUNT_OWNER &&
    ctx.user.scope !== DB.UserLoginScope.FULL_ACCESS
  ) {
    throw new GraphQLError(
      'This login is not allowed to change product update state'
    )
  }

  return actor
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

// A row can be created by a read or a dismissal that arrives before any
// presentation was recorded. The presentation timestamps are not nullable, so
// they are filled with the moment the entry demonstrably reached the actor,
// while `presentationCount` keeps counting explicit presentations only.
//
// The empty `update` makes this an insert-if-absent: Prisma delegates it to a
// native database upsert, so two concurrent first interactions cannot collide
// on the unique constraint.
function insertStateIfAbsent(
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
    return ctx.prisma.userProductUpdateState.upsert({
      where: { userId_updateId: { userId: actor.id, updateId } },
      create: { ...state, userId: actor.id },
      update: {},
    })
  }

  return ctx.prisma.participantProductUpdateState.upsert({
    where: { participantId_updateId: { participantId: actor.id, updateId } },
    create: { ...state, participantId: actor.id },
    update: {},
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

// `readAt` and `dismissedAt` record the first read and the first dismissal, so
// once set they never move: a second call returns the row unchanged.
async function claimStateTimestamp(
  actor: ProductUpdateActor,
  updateId: string,
  field: 'readAt' | 'dismissedAt',
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  const now = new Date()
  const state = await insertStateIfAbsent(
    actor,
    updateId,
    { [field]: now },
    now,
    ctx
  )

  if (state[field]) {
    return state
  }

  return updateState(actor, updateId, { [field]: now }, ctx)
}

export async function markProductUpdateRead(
  { updateId }: ProductUpdateStateArgs,
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  const actor = resolveWritingActor(ctx)
  assertKnownUpdateIds([updateId])

  return await claimStateTimestamp(actor, updateId, 'readAt', ctx)
}

export async function dismissProductUpdate(
  { updateId }: ProductUpdateStateArgs,
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  const actor = resolveWritingActor(ctx)
  assertKnownUpdateIds([updateId])

  return await claimStateTimestamp(actor, updateId, 'dismissedAt', ctx)
}

export async function recordProductUpdatePresentation(
  { updateId }: ProductUpdateStateArgs,
  ctx: ContextWithUser
): Promise<ProductUpdateState> {
  const actor = resolveWritingActor(ctx)
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
