import * as DB from '@klicker-uzh/prisma/client'
import {
  isParticipantDataUseComplete,
  PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  participantDataUseSelect,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import { z } from 'zod'
import type { ContextWithUser } from '../lib/context.js'

const accountDataUseSelect = {
  ...participantDataUseSelect,
  id: true,
  dataUseAcknowledgedAt: true,
  dataUseAcknowledgedVersion: true,
  dataUseRevision: true,
} satisfies DB.Prisma.ParticipantSelect

export type ParticipantAccountDataUseFields = DB.Prisma.ParticipantGetPayload<{
  select: typeof accountDataUseSelect
}>

export async function getParticipantAccountDataUse(ctx: ContextWithUser) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw dataUseError('PARTICIPANT_DATA_USE_FORBIDDEN')
  }
  return ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    select: accountDataUseSelect,
  })
}

const completionInput = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    disclosureVersion: z.literal(PARTICIPANT_DATA_USE_DISCLOSURE_VERSION),
    researchConsent: z.boolean(),
    learningAnalyticsConsent: z.boolean(),
    acknowledged: z.literal(true),
  })
  .strict()

function dataUseError(code: string) {
  return new GraphQLError(code, { extensions: { code } })
}

function isLockTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    code?: unknown
    meta?: unknown
    cause?: unknown
  }
  if (candidate.code === '55P03') return true
  const metaCode =
    candidate.meta && typeof candidate.meta === 'object'
      ? (candidate.meta as { code?: unknown }).code
      : undefined
  const driverCause =
    candidate.meta && typeof candidate.meta === 'object'
      ? (
          candidate.meta as {
            driverAdapterError?: { cause?: { code?: unknown } }
          }
        ).driverAdapterError?.cause
      : undefined
  if (
    candidate.code === 'P2010' &&
    (metaCode === '55P03' || driverCause?.code === '55P03')
  ) {
    return true
  }

  return isLockTimeoutError(candidate.cause)
}

export function validateInitialParticipantDataUse(input: unknown) {
  const parsed = completionInput
    .omit({ expectedRevision: true })
    .safeParse(input)
  if (!parsed.success) throw dataUseError('PARTICIPANT_DATA_USE_INVALID_INPUT')
  return parsed.data
}

export async function initialParticipantDataUseData(
  input: ReturnType<typeof validateInitialParticipantDataUse>,
  prisma: DB.Prisma.TransactionClient
) {
  const clock = await prisma.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS "now"
  `
  const now = clock[0]?.now
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw dataUseError('PARTICIPANT_DATA_USE_CLOCK_FAILURE')
  }
  return {
    researchConsent: input.researchConsent,
    researchConsentChoiceAt: now,
    researchConsentDisclosureVersion: input.disclosureVersion,
    learningAnalyticsConsent: input.learningAnalyticsConsent,
    learningAnalyticsChoiceAt: now,
    learningAnalyticsDisclosureVersion: input.disclosureVersion,
    dataUseAcknowledgedAt: now,
    dataUseAcknowledgedVersion: input.disclosureVersion,
    dataUseRevision: 1,
    dataUseEvents: {
      create: {
        revision: 1,
        disclosureVersion: input.disclosureVersion,
        researchConsent: input.researchConsent,
        learningAnalyticsConsent: input.learningAnalyticsConsent,
        acknowledged: true,
        createdAt: now,
      },
    },
  }
}

export async function completeParticipantDataUse(
  input: unknown,
  ctx: ContextWithUser
) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw dataUseError('PARTICIPANT_DATA_USE_FORBIDDEN')
  }
  const parsed = completionInput.safeParse(input)
  if (!parsed.success) throw dataUseError('PARTICIPANT_DATA_USE_INVALID_INPUT')
  return saveParticipantDataUse({ kind: 'completion', ...parsed.data }, ctx)
}

const choiceInput = completionInput
  .pick({ expectedRevision: true, disclosureVersion: true })
  .extend({ consent: z.boolean() })

export async function updateParticipantDataUseChoice(
  purpose: 'research' | 'analytics',
  input: unknown,
  ctx: ContextWithUser
) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw dataUseError('PARTICIPANT_DATA_USE_FORBIDDEN')
  }
  const parsed = choiceInput.safeParse(input)
  if (!parsed.success) throw dataUseError('PARTICIPANT_DATA_USE_INVALID_INPUT')
  return saveParticipantDataUse({ kind: purpose, ...parsed.data }, ctx)
}

async function saveParticipantDataUse(
  input:
    | ({ kind: 'completion' } & z.infer<typeof completionInput>)
    | ({ kind: 'research' | 'analytics' } & z.infer<typeof choiceInput>),
  ctx: ContextWithUser
) {
  return ctx.prisma
    .$transaction(
      async (prisma) => {
        await prisma.$executeRaw`SET LOCAL lock_timeout = '5s'`
        await prisma.$queryRaw`
      SELECT "id" FROM "Participant"
      WHERE "id" = ${ctx.user.sub}::uuid FOR UPDATE
    `
        const participant = await prisma.participant.findUnique({
          where: { id: ctx.user.sub },
          select: accountDataUseSelect,
        })
        if (!participant) throw dataUseError('PARTICIPANT_DATA_USE_FORBIDDEN')

        if (
          input.kind !== 'completion' &&
          !isParticipantDataUseComplete(participant)
        ) {
          throw dataUseError('PARTICIPANT_DATA_USE_COMPLETION_REQUIRED')
        }
        const request =
          input.kind === 'completion'
            ? input
            : {
                ...input,
                researchConsent:
                  input.kind === 'research'
                    ? input.consent
                    : participant.researchConsent,
                learningAnalyticsConsent:
                  input.kind === 'analytics'
                    ? input.consent
                    : participant.learningAnalyticsConsent,
              }

        const researchUnchanged =
          participant.researchConsent === request.researchConsent &&
          participant.researchConsentChoiceAt !== null &&
          participant.researchConsentDisclosureVersion !== null
        const analyticsUnchanged =
          participant.learningAnalyticsConsent ===
            request.learningAnalyticsConsent &&
          participant.learningAnalyticsChoiceAt !== null &&
          participant.learningAnalyticsDisclosureVersion !== null
        const acknowledged =
          participant.dataUseAcknowledgedAt !== null &&
          participant.dataUseAcknowledgedVersion === request.disclosureVersion

        if (participant.dataUseRevision !== request.expectedRevision) {
          // Only the immediately repeated successful submission is idempotent.
          if (
            input.kind === 'completion' &&
            participant.dataUseRevision === request.expectedRevision + 1 &&
            researchUnchanged &&
            analyticsUnchanged &&
            acknowledged
          )
            return participant
          throw dataUseError('PARTICIPANT_DATA_USE_STALE_REVISION')
        }
        if (researchUnchanged && analyticsUnchanged && acknowledged)
          return participant

        const clock = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS "now"
    `
        const now = clock[0]?.now
        if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
          throw dataUseError('PARTICIPANT_DATA_USE_CLOCK_FAILURE')
        }
        const updated = await prisma.participant.update({
          where: { id: participant.id },
          select: accountDataUseSelect,
          data: {
            dataUseRevision: { increment: 1 },
            dataUseAcknowledgedAt: acknowledged
              ? participant.dataUseAcknowledgedAt
              : now,
            dataUseAcknowledgedVersion: request.disclosureVersion,
            ...(!researchUnchanged && {
              researchConsent: request.researchConsent,
              researchConsentChoiceAt: now,
              researchConsentDisclosureVersion: request.disclosureVersion,
            }),
            ...(!analyticsUnchanged && {
              learningAnalyticsConsent: request.learningAnalyticsConsent,
              learningAnalyticsChoiceAt: now,
              learningAnalyticsDisclosureVersion: request.disclosureVersion,
            }),
          },
        })
        await prisma.participantDataUseEvent.create({
          data: {
            participantId: participant.id,
            revision: updated.dataUseRevision,
            disclosureVersion: request.disclosureVersion,
            researchConsent: updated.researchConsent,
            learningAnalyticsConsent: updated.learningAnalyticsConsent,
            acknowledged: true,
            createdAt: now,
          },
        })
        return updated
      },
      { maxWait: 10_000, timeout: 60_000 }
    )
    .catch((error: unknown) => {
      if (isLockTimeoutError(error)) {
        throw dataUseError('PARTICIPANT_DATA_USE_LOCK_TIMEOUT')
      }
      throw error
    })
}
