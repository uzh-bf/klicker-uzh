import { prisma } from '@klicker-uzh/prisma'
import {
  PRODUCT_UPDATES,
  type ProductUpdate,
  selectEligibleUpdates,
} from '@klicker-uzh/product-updates'

// The canonical twin of the write logic below is
// `packages/graphql/src/services/productUpdates.ts`, which serves the same two
// tables for both actor kinds. Chat reaches Prisma directly instead of going
// through the GraphQL API, like every other data path in this app, so the
// participant half is restated here. Keep the two in step: the concurrency
// behaviour, not just the field list, is the contract.

const KNOWN_UPDATE_IDS = new Set(PRODUCT_UPDATES.map((update) => update.id))

export function isKnownUpdateId(updateId: string): boolean {
  return KNOWN_UPDATE_IDS.has(updateId)
}

export interface ChatProductUpdate {
  id: string
  publishedAt: string
  title: string
  summary: string
  detailsUrl?: string
  readAt: string | null
  dismissedAt: string | null
}

// Prisma reports a unique constraint violation as error code `P2002`. The check
// is structural so that the service does not have to import the client runtime
// error class.
function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

function localized(text: { de: string; en: string }, locale: string): string {
  return locale === 'de' ? text.de : text.en
}

/**
 * The entries a participant may currently see in chat, newest first, with the
 * ones they already dismissed removed.
 *
 * Feature flags are not evaluated on this surface, so an entry that requires a
 * flag is never eligible here. That is the fail-closed direction: a gated entry
 * stays hidden rather than leaking to a cohort it was not released to.
 */
export async function getChatProductUpdates(
  participantId: string,
  locale: string
): Promise<ChatProductUpdate[]> {
  const eligible: ProductUpdate[] = selectEligibleUpdates({
    updates: PRODUCT_UPDATES,
    audience: 'student',
    surface: 'chat',
  })

  if (eligible.length === 0) return []

  const states = await prisma.participantProductUpdateState.findMany({
    where: {
      participantId,
      updateId: { in: eligible.map((update) => update.id) },
    },
  })
  const stateByUpdateId = new Map(
    states.map((state) => [state.updateId, state])
  )

  return eligible
    .filter((update) => !stateByUpdateId.get(update.id)?.dismissedAt)
    .map((update) => {
      const state = stateByUpdateId.get(update.id)
      return {
        id: update.id,
        publishedAt: update.publishedAt,
        title: localized(update.title, locale),
        summary: localized(update.summary, locale),
        detailsUrl: update.detailsUrl,
        readAt: state?.readAt?.toISOString() ?? null,
        dismissedAt: state?.dismissedAt?.toISOString() ?? null,
      }
    })
}

// A row can be created by a read or a dismissal that arrives before any
// presentation was recorded. The presentation timestamps are not nullable, so
// they are filled with the moment the entry demonstrably reached the actor,
// while `presentationCount` keeps counting explicit presentations only.
//
// The empty `update` makes this an insert-if-absent, but it also stops Prisma
// from emitting a native `INSERT ... ON CONFLICT`: with nothing to set, the
// upsert becomes a find-then-create, so a concurrent first interaction on the
// same entry makes one of the two inserts violate the unique constraint. That
// collision proves the row now exists, which is what insert-if-absent asks for,
// so it is answered with a read of the row the other write created.
async function insertStateIfAbsent(
  participantId: string,
  updateId: string,
  data: { readAt?: Date; dismissedAt?: Date },
  now: Date
) {
  try {
    return await prisma.participantProductUpdateState.upsert({
      where: { participantId_updateId: { participantId, updateId } },
      create: {
        participantId,
        updateId,
        firstPresentedAt: now,
        lastPresentedAt: now,
        ...data,
      },
      update: {},
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    return await prisma.participantProductUpdateState.findUniqueOrThrow({
      where: { participantId_updateId: { participantId, updateId } },
    })
  }
}

// `readAt` and `dismissedAt` record the first read and the first dismissal, so
// once set they never move: a second call returns the row unchanged.
async function claimStateTimestamp(
  participantId: string,
  updateId: string,
  field: 'readAt' | 'dismissedAt'
) {
  const now = new Date()
  const state = await insertStateIfAbsent(
    participantId,
    updateId,
    { [field]: now },
    now
  )

  if (state[field]) {
    return state
  }

  return await prisma.participantProductUpdateState.update({
    where: { participantId_updateId: { participantId, updateId } },
    data: { [field]: now },
  })
}

export async function markProductUpdateRead(
  participantId: string,
  updateId: string
) {
  return await claimStateTimestamp(participantId, updateId, 'readAt')
}

export async function dismissProductUpdate(
  participantId: string,
  updateId: string
) {
  return await claimStateTimestamp(participantId, updateId, 'dismissedAt')
}

export async function recordProductUpdatePresentation(
  participantId: string,
  updateId: string
) {
  const now = new Date()

  // Unlike the insert-if-absent above, the non-empty `update` gives Prisma
  // something to set, so this stays a native `INSERT ... ON CONFLICT` that
  // cannot lose a presentation recorded concurrently in a second tab.
  return await prisma.participantProductUpdateState.upsert({
    where: { participantId_updateId: { participantId, updateId } },
    create: {
      participantId,
      updateId,
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
