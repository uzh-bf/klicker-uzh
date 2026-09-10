import * as DB from '@klicker-uzh/prisma/client'
import { questionGenerationServiceError } from './questionGenerationErrors.js'

type QuestionReviewClient = Pick<
  DB.PrismaClient,
  'elementGenerationBuild' | 'elementGenerationReview'
>
type LeasedQuestionReview = {
  buildId: string
  ownerId: string
  gate: DB.ElementGenerationReviewGate
  leaseOwner: string
}

export function questionReviewState(
  gate: DB.ElementGenerationReviewGate,
  decision: DB.ElementGenerationReviewDecision
) {
  const expectedStatus =
    gate === DB.ElementGenerationReviewGate.DESIGN
      ? DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW
      : DB.ElementGenerationBuildStatus.WAITING_FOR_PLAN_REVIEW
  const nextStatus =
    decision === DB.ElementGenerationReviewDecision.REJECT
      ? DB.ElementGenerationBuildStatus.REJECTED
      : gate === DB.ElementGenerationReviewGate.DESIGN
        ? DB.ElementGenerationBuildStatus.GENERATING_ITEMS
        : DB.ElementGenerationBuildStatus.FINALIZING
  const nextStage =
    decision === DB.ElementGenerationReviewDecision.REJECT
      ? 'rejected'
      : gate === DB.ElementGenerationReviewGate.DESIGN
        ? 'stems'
        : 'finalizing'
  return { expectedStatus, nextStatus, nextStage }
}

export function recordQuestionReviewDecision(
  prisma: Pick<QuestionReviewClient, 'elementGenerationReview'>,
  data: Pick<
    DB.Prisma.ElementGenerationReviewUncheckedCreateInput,
    | 'id'
    | 'buildId'
    | 'gate'
    | 'decision'
    | 'reviewerId'
    | 'warningsAcknowledged'
    | 'artifact'
    | 'reviewedAt'
  >
) {
  return prisma.elementGenerationReview.create({ data })
}

export async function recordQuestionReviewWorkflowFailure(
  prisma: Pick<QuestionReviewClient, 'elementGenerationBuild'>,
  input: LeasedQuestionReview & { status: 'FAILED' | 'CANCELLED' }
) {
  const { expectedStatus } = questionReviewState(
    input.gate,
    DB.ElementGenerationReviewDecision.APPROVE
  )
  await prisma.elementGenerationBuild.updateMany({
    where: {
      id: input.buildId,
      ownerId: input.ownerId,
      status: expectedStatus,
      syncLeaseOwner: input.leaseOwner,
    },
    data: {
      status: DB.ElementGenerationBuildStatus.FAILED,
      stage: 'failed',
      errorCode: `WORKFLOW_${input.status}`,
      errorMessage: 'Question-generation review workflow did not complete',
      errorRetryable: false,
      completedAt: new Date(),
    },
  })
}

export async function advanceQuestionReview(
  prisma: Pick<QuestionReviewClient, 'elementGenerationBuild'>,
  input: LeasedQuestionReview & { decision: DB.ElementGenerationReviewDecision }
) {
  const { expectedStatus, nextStatus, nextStage } = questionReviewState(
    input.gate,
    input.decision
  )
  const updated = await prisma.elementGenerationBuild.updateMany({
    where: {
      id: input.buildId,
      ownerId: input.ownerId,
      status: expectedStatus,
      syncLeaseOwner: input.leaseOwner,
    },
    data: {
      status: nextStatus,
      stage: nextStage,
      completedAt:
        nextStatus === DB.ElementGenerationBuildStatus.REJECTED
          ? new Date()
          : null,
    },
  })
  if (updated.count !== 1) {
    throw questionGenerationServiceError(
      'CONCURRENT_MODIFICATION',
      'Question-generation review was changed by another request'
    )
  }
}
