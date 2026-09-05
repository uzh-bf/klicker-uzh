import * as DB from '@klicker-uzh/prisma/client'
import { isKnownTourId } from '@klicker-uzh/product-tours'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

// The two actor tables carry the same state columns and differ only in their
// foreign key, so every resolver returns this common subset.
export interface TourState {
  id: number
  tourId: string
  completedAt: Date | null
}

type TourActor =
  | { type: 'user'; id: string }
  | { type: 'participant'; id: string }

// The actor is derived from the authenticated session only; no resolver takes
// an actor id from the caller. Temporary and anonymous live-quiz participants
// never get onboarding overlays, so they are rejected here rather than silently
// collecting state nobody reads.
function resolveActor(ctx: ContextWithUser): TourActor {
  switch (ctx.user.role) {
    case DB.UserRole.USER:
    case DB.UserRole.ADMIN:
      return { type: 'user', id: ctx.user.sub }

    case DB.UserRole.PARTICIPANT:
      return { type: 'participant', id: ctx.user.sub }

    default:
      throw new GraphQLError('This account type does not receive guided tours')
  }
}

// Writes follow the repository's scope floor for mutations: a delegated
// lecturer login that may only read or run a live quiz sees its own state but
// cannot change it. Participant tokens carry no scope claim at all, so the
// floor applies to lecturer sessions only.
function resolveWritingActor(ctx: ContextWithUser): TourActor {
  const actor = resolveActor(ctx)

  if (
    actor.type === 'user' &&
    ctx.user.scope !== DB.UserLoginScope.ACCOUNT_OWNER &&
    ctx.user.scope !== DB.UserLoginScope.FULL_ACCESS
  ) {
    throw new GraphQLError('This login is not allowed to change tour state')
  }

  return actor
}

interface GetTourStatesArgs {
  tourIds: string[]
}

export async function getTourStates(
  { tourIds }: GetTourStatesArgs,
  ctx: ContextWithUser
): Promise<TourState[]> {
  const actor = resolveActor(ctx)

  // Unknown ids are ignored instead of rejected: during a rollout a newer
  // frontend asks about a tour an older backend does not carry yet, and failing
  // the whole query would also hide the state of the tours it does know.
  const knownIds = tourIds.filter((id) => isKnownTourId(id))

  // A tour the actor has never ended has no row; the caller treats a missing
  // entry as "not completed yet".
  if (actor.type === 'user') {
    return ctx.prisma.userTourState.findMany({
      where: { userId: actor.id, tourId: { in: knownIds } },
    })
  }

  return ctx.prisma.participantTourState.findMany({
    where: { participantId: actor.id, tourId: { in: knownIds } },
  })
}

interface MarkTourCompletedArgs {
  tourId: string
}

export async function markTourCompleted(
  { tourId }: MarkTourCompletedArgs,
  ctx: ContextWithUser
): Promise<TourState> {
  const actor = resolveWritingActor(ctx)

  // `tourId` has no foreign key because tours live in code, so an unknown id
  // would otherwise create a row that no surface can ever read or clean up.
  if (!isKnownTourId(tourId)) {
    throw new GraphQLError(`Unknown tour id: ${tourId}`)
  }

  const now = new Date()

  // `completedAt` records the first ending and never moves, so a replay reports
  // completion again without rewriting it. The `update` branch therefore
  // touches only the housekeeping timestamp — but it must not be empty, because
  // Prisma turns an empty update into a read-then-insert that two concurrent
  // calls can race into a unique-constraint error. This mutation is the only
  // writer of both tables, and it always sets `completedAt` on insert, so every
  // row it can meet here already carries a completion.
  return actor.type === 'user'
    ? await ctx.prisma.userTourState.upsert({
        where: { userId_tourId: { userId: actor.id, tourId } },
        create: { tourId, userId: actor.id, completedAt: now },
        update: { updatedAt: now },
      })
    : await ctx.prisma.participantTourState.upsert({
        where: { participantId_tourId: { participantId: actor.id, tourId } },
        create: { tourId, participantId: actor.id, completedAt: now },
        update: { updatedAt: now },
      })
}
