import { deriveGuestSsoId, GUEST_ACCOUNT_TYPE } from '@klicker-uzh/util'
import type { Context } from '../lib/context.js'

export interface GuestThreadClaimResult {
  personas: number
  threads: number
}

/**
 * Move a person's course-scoped guest chat threads onto their real account.
 *
 * The guest persona key is a deterministic per-course HMAC over the verified
 * LTI subject and the course id (see the shared derivation helper). For every
 * course the account participates in we recompute that key, look up the
 * persona's row and reassign its threads. The subject used here is the
 * verified launch subject, never the browser cookie identity.
 */
export async function claimGuestChatThreads(
  {
    ltiSub,
    participantId,
  }: {
    ltiSub: string
    participantId: string
  },
  ctx: Context
): Promise<GuestThreadClaimResult> {
  return ctx.prisma.$transaction(async (prisma) => {
    // The claim may only move threads into the account the verified subject
    // itself resolves to. On the subject-verified launch path this always
    // holds, because the resolver linked or found an account for the subject.
    // On the session-precedence path (a valid cookie of a different account
    // wins) this check fails and the claim is skipped, so threads never move
    // between accounts.
    const subjectAccount = await prisma.participantAccount.findFirst({
      where: { ssoId: ltiSub, type: { not: GUEST_ACCOUNT_TYPE } },
      select: { participantId: true },
    })
    if (!subjectAccount || subjectAccount.participantId !== participantId) {
      return { personas: 0, threads: 0 }
    }

    const participations = await prisma.participation.findMany({
      where: { participantId },
      select: { courseId: true },
    })

    let personas = 0
    let threads = 0

    for (const { courseId } of participations) {
      const personaAccount = await prisma.participantAccount.findFirst({
        where: {
          ssoId: deriveGuestSsoId(ltiSub, courseId),
          type: GUEST_ACCOUNT_TYPE,
        },
        select: { participantId: true },
      })
      if (!personaAccount || personaAccount.participantId === participantId)
        continue

      const moved = await prisma.chatThread.updateMany({
        where: { participantId: personaAccount.participantId },
        data: { participantId },
      })
      personas += 1
      threads += moved.count
    }

    return { personas, threads }
  })
}
