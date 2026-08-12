import { randomUUID } from 'node:crypto'
import {
  type AuditEventDraft,
  createTrustedAuditContext,
  emitAuditEvents,
  type RolloutBaselinePayload,
  runInAuditTransaction,
} from '@klicker-uzh/audit'
import * as DB from '@klicker-uzh/prisma/client'
import type { Prisma } from '@klicker-uzh/prisma/client'
import {
  activateAssessmentAudit,
  type AssessmentAuditMediaDependencies,
  type AssessmentAuditRolloutObservation,
  assessmentIsSelectedForAuditActivation,
  readAssessmentAuditRolloutConfig,
} from './assessmentAuditActivation.js'

const ROLLOUT_QUIZ_SELECT = {
  id: true,
  courseId: true,
  status: true,
  isDeleted: true,
  isAssessmentEnabled: true,
  startedAt: true,
  finishedAt: true,
  updatedAt: true,
} satisfies Prisma.LiveQuizSelect

type RolloutQuiz = Prisma.LiveQuizGetPayload<{
  select: typeof ROLLOUT_QUIZ_SELECT
}>

export type AssessmentAuditRolloutCandidate = {
  liveQuizId: string
  courseId: string | null
  lifecycleState: RolloutBaselinePayload['observedLifecycleState']
  terminalAt: string | null
}

export type AssessmentAuditRolloutInventoryItem =
  AssessmentAuditRolloutObservation & {
    liveQuizId: string
    outcome: DB.AssessmentAuditRolloutOutcome
  }

export type AssessmentAuditRolloutFailureReason =
  | 'ASSESSMENT_BASELINE_ACTIVATION_FAILED'
  | 'ASSESSMENT_CHANGED_DURING_ROLLOUT'

const TERMINAL_STATES = new Set<
  RolloutBaselinePayload['observedLifecycleState']
>(['COMPLETED', 'CANCELLED', 'DELETED'])

function lifecycleState(
  quiz: RolloutQuiz
): RolloutBaselinePayload['observedLifecycleState'] {
  if (quiz.isDeleted) return 'DELETED'
  switch (quiz.status) {
    case DB.PublicationStatus.DRAFT:
      return 'DRAFT'
    case DB.PublicationStatus.SCHEDULED:
      return 'SCHEDULED'
    case DB.PublicationStatus.PUBLISHED:
      return quiz.startedAt === null ? 'PUBLISHED' : 'RUNNING'
    case DB.PublicationStatus.ENDED:
    case DB.PublicationStatus.GRADED:
      return 'COMPLETED'
    case DB.PublicationStatus.TEMPLATE:
      throw new Error('Assessment audit rollout cannot include a template')
  }
}

function mapCandidate(quiz: RolloutQuiz): AssessmentAuditRolloutCandidate {
  const state = lifecycleState(quiz)
  const terminalAt = TERMINAL_STATES.has(state)
    ? (quiz.finishedAt ?? quiz.updatedAt).toISOString()
    : null
  return {
    liveQuizId: quiz.id,
    courseId: quiz.courseId,
    lifecycleState: state,
    terminalAt,
  }
}

export async function discoverAssessmentAuditRolloutCandidates(input: {
  client: DB.PrismaClient
  liveQuizIds?: readonly string[]
}): Promise<{
  candidates: AssessmentAuditRolloutCandidate[]
  missingLiveQuizIds: string[]
}> {
  const requested = [...new Set(input.liveQuizIds ?? [])].sort()
  const quizzes = await input.client.liveQuiz.findMany({
    where: {
      isAssessmentEnabled: true,
      status: { not: DB.PublicationStatus.TEMPLATE },
      ...(requested.length === 0 ? {} : { id: { in: requested } }),
    },
    orderBy: { id: 'asc' },
    select: ROLLOUT_QUIZ_SELECT,
  })
  const found = new Set(quizzes.map((quiz) => quiz.id))
  return {
    candidates: quizzes.map(mapCandidate),
    missingLiveQuizIds: requested.filter((id) => !found.has(id)),
  }
}

export async function beginOrResumeAssessmentAuditRollout(input: {
  client: DB.PrismaClient
  scanId: string
  observedAt: Date
  candidates: readonly AssessmentAuditRolloutCandidate[]
}): Promise<AssessmentAuditRolloutInventoryItem[]> {
  const observedAt = input.observedAt.toISOString()
  return input.client.$transaction(async (tx) => {
    const existing = await tx.assessmentAuditRolloutInventory.findMany({
      where: { scanId: input.scanId },
      orderBy: { liveQuizId: 'asc' },
    })
    if (existing.length === 0) {
      await tx.assessmentAuditRolloutInventory.createMany({
        data: input.candidates.map((candidate) => ({
          scanId: input.scanId,
          liveQuizId: candidate.liveQuizId,
          observedAt: input.observedAt,
          observedLifecycleState: candidate.lifecycleState,
          outcome: DB.AssessmentAuditRolloutOutcome.PENDING,
        })),
      })
      return input.candidates.map((candidate) => ({
        scanId: input.scanId,
        liveQuizId: candidate.liveQuizId,
        observedAt,
        observedLifecycleState: candidate.lifecycleState,
        outcome: DB.AssessmentAuditRolloutOutcome.PENDING,
      }))
    }

    return existing.map((item) => ({
      scanId: item.scanId,
      liveQuizId: item.liveQuizId,
      observedAt: item.observedAt.toISOString(),
      observedLifecycleState:
        item.observedLifecycleState as RolloutBaselinePayload['observedLifecycleState'],
      outcome: item.outcome,
    }))
  })
}

function rolloutContext(input: {
  candidate: AssessmentAuditRolloutCandidate
  inventory: AssessmentAuditRolloutInventoryItem
  lifecycleEpoch: number
  recordedAt: string
}) {
  return createTrustedAuditContext({
    recordedVia: 'TRANSACTIONAL_OUTBOX',
    receivedAt: input.inventory.observedAt,
    recordedAt: input.recordedAt,
    actor: { kind: 'SYSTEM' },
    authorization: {
      decision: 'NOT_APPLICABLE',
      authScope: 'SYSTEM_ROLLOUT',
      resolvedObjectScope: {
        type: 'LIVE_QUIZ',
        id: input.inventory.liveQuizId,
      },
    },
    scope: {
      liveQuizId: input.inventory.liveQuizId,
      lifecycleEpoch: input.lifecycleEpoch,
      ...(input.candidate.courseId === null
        ? {}
        : { courseId: input.candidate.courseId }),
    },
    correlationId: input.inventory.scanId,
  })
}

function rolloutDraft(input: {
  candidate: AssessmentAuditRolloutCandidate
  inventory: AssessmentAuditRolloutInventoryItem
  lifecycleEpoch: number
  outcome: 'EXCLUDED_TERMINAL' | 'FAILED'
  coverageState: 'EXCLUDED_TERMINAL' | 'UNCOVERED'
  reasonCode: string
}): AuditEventDraft<'ASSESSMENT_ROLLOUT_BASELINE_RECORDED'> {
  const terminalAt =
    input.outcome === 'EXCLUDED_TERMINAL' ? input.candidate.terminalAt : null
  return {
    eventType: 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED',
    producerOperationId: `${input.inventory.scanId}:${input.inventory.liveQuizId}:terminal`,
    payload: {
      scanId: input.inventory.scanId,
      observedAt: input.inventory.observedAt,
      observedLifecycleState: input.inventory.observedLifecycleState,
      lifecycleEpoch: input.lifecycleEpoch,
      outcome: input.outcome,
      coverageState: input.coverageState,
      baselineId: null,
      terminalAt,
      retentionAnchorAt: terminalAt,
      reasonCode: input.reasonCode,
    },
  }
}

async function finalizeTerminalExclusion(input: {
  client: DB.PrismaClient
  candidate: AssessmentAuditRolloutCandidate
  inventory: AssessmentAuditRolloutInventoryItem
}) {
  if (
    !TERMINAL_STATES.has(input.inventory.observedLifecycleState) ||
    input.candidate.terminalAt === null
  ) {
    throw new Error('Terminal rollout exclusion is missing its stable anchor')
  }
  return runInAuditTransaction(input.client, async (tx, auditTx) => {
    const terminalAt = new Date(input.candidate.terminalAt!)
    const existingScope = await tx.assessmentAuditScope.findUnique({
      where: {
        liveQuizId_lifecycleEpoch: {
          liveQuizId: input.inventory.liveQuizId,
          lifecycleEpoch: 0,
        },
      },
    })
    const terminalFields =
      input.inventory.observedLifecycleState === 'COMPLETED'
        ? { completedAt: terminalAt }
        : input.inventory.observedLifecycleState === 'CANCELLED'
          ? { cancelledAt: terminalAt }
          : { deletedAt: terminalAt }
    if (existingScope === null) {
      await tx.assessmentAuditScope.create({
        data: {
          liveQuizId: input.inventory.liveQuizId,
          lifecycleEpoch: 0,
          coverageState: DB.AssessmentAuditCoverageState.EXCLUDED_TERMINAL,
          retentionAnchorAt: terminalAt,
          ...terminalFields,
        },
      })
    } else if (
      existingScope.coverageState !==
        DB.AssessmentAuditCoverageState.EXCLUDED_TERMINAL ||
      existingScope.retentionAnchorAt?.getTime() !== terminalAt.getTime()
    ) {
      throw new Error('Terminal rollout scope conflicts with existing evidence')
    }

    const recordedAt = new Date(
      Math.max(Date.now(), new Date(input.inventory.observedAt).getTime())
    ).toISOString()
    const [event] = await emitAuditEvents(
      auditTx,
      rolloutContext({
        candidate: input.candidate,
        inventory: input.inventory,
        lifecycleEpoch: 0,
        recordedAt,
      }),
      [
        rolloutDraft({
          candidate: input.candidate,
          inventory: input.inventory,
          lifecycleEpoch: 0,
          outcome: 'EXCLUDED_TERMINAL',
          coverageState: 'EXCLUDED_TERMINAL',
          reasonCode: 'PRE_ROLLOUT_TERMINAL_STATE',
        }),
      ]
    )
    if (event === undefined) {
      throw new Error('Terminal rollout evidence was not emitted')
    }
    const updated = await tx.assessmentAuditRolloutInventory.updateMany({
      where: {
        scanId: input.inventory.scanId,
        liveQuizId: input.inventory.liveQuizId,
        outcome: DB.AssessmentAuditRolloutOutcome.PENDING,
      },
      data: {
        outcome: DB.AssessmentAuditRolloutOutcome.EXCLUDED_TERMINAL,
        stableReason: 'PRE_ROLLOUT_TERMINAL_STATE',
        rolloutEventId: event.eventId,
      },
    })
    if (updated.count === 0) {
      throw new Error('Terminal rollout inventory is not pending')
    }
    return DB.AssessmentAuditRolloutOutcome.EXCLUDED_TERMINAL
  })
}

async function reconcileRolloutFailure(input: {
  client: DB.PrismaClient
  candidate: AssessmentAuditRolloutCandidate
  inventory: AssessmentAuditRolloutInventoryItem
  reason: AssessmentAuditRolloutFailureReason
}) {
  if (TERMINAL_STATES.has(input.inventory.observedLifecycleState)) {
    throw new Error('Terminal rollout failure must remain pending for retry')
  }
  return runInAuditTransaction(input.client, async (tx, auditTx) => {
    const current = await tx.assessmentAuditRolloutInventory.findUniqueOrThrow({
      where: {
        scanId_liveQuizId: {
          scanId: input.inventory.scanId,
          liveQuizId: input.inventory.liveQuizId,
        },
      },
    })
    if (current.outcome === DB.AssessmentAuditRolloutOutcome.FAILED) {
      return current.outcome
    }
    if (current.outcome !== DB.AssessmentAuditRolloutOutcome.PENDING) {
      throw new Error('Rollout failure reconciliation found a terminal outcome')
    }
    const latestScope = await tx.assessmentAuditScope.findFirst({
      where: { liveQuizId: input.inventory.liveQuizId },
      orderBy: { lifecycleEpoch: 'desc' },
      select: { lifecycleEpoch: true },
    })
    const lifecycleEpoch = (latestScope?.lifecycleEpoch ?? 0) + 1
    await tx.assessmentAuditScope.create({
      data: {
        liveQuizId: input.inventory.liveQuizId,
        lifecycleEpoch,
        coverageState: DB.AssessmentAuditCoverageState.FAILED,
      },
    })
    const recordedAt = new Date(
      Math.max(Date.now(), new Date(input.inventory.observedAt).getTime())
    ).toISOString()
    const [event] = await emitAuditEvents(
      auditTx,
      rolloutContext({
        candidate: input.candidate,
        inventory: input.inventory,
        lifecycleEpoch,
        recordedAt,
      }),
      [
        rolloutDraft({
          candidate: input.candidate,
          inventory: input.inventory,
          lifecycleEpoch,
          outcome: 'FAILED',
          coverageState: 'UNCOVERED',
          reasonCode: input.reason,
        }),
      ]
    )
    if (event === undefined) {
      throw new Error('Failed rollout evidence was not emitted')
    }
    await tx.assessmentAuditRolloutInventory.update({
      where: {
        scanId_liveQuizId: {
          scanId: input.inventory.scanId,
          liveQuizId: input.inventory.liveQuizId,
        },
      },
      data: {
        outcome: DB.AssessmentAuditRolloutOutcome.FAILED,
        stableReason: input.reason,
        rolloutEventId: event.eventId,
      },
    })
    return DB.AssessmentAuditRolloutOutcome.FAILED
  })
}

export async function processAssessmentAuditRolloutItem(input: {
  client: DB.PrismaClient
  candidate: AssessmentAuditRolloutCandidate
  inventory: AssessmentAuditRolloutInventoryItem
  media?: AssessmentAuditMediaDependencies
  baselineKind?: 'CREATION' | 'ROLLOUT_CONFIGURATION_CURRENT_STATE'
}): Promise<DB.AssessmentAuditRolloutOutcome> {
  if (input.inventory.outcome !== DB.AssessmentAuditRolloutOutcome.PENDING) {
    return input.inventory.outcome
  }
  if (
    input.candidate.lifecycleState !== input.inventory.observedLifecycleState
  ) {
    return reconcileRolloutFailure({
      ...input,
      reason: 'ASSESSMENT_CHANGED_DURING_ROLLOUT',
    })
  }
  if (TERMINAL_STATES.has(input.inventory.observedLifecycleState)) {
    return finalizeTerminalExclusion(input)
  }

  try {
    await activateAssessmentAudit({
      client: input.client,
      liveQuizId: input.inventory.liveQuizId,
      baselineKind: input.baselineKind ?? 'ROLLOUT_CONFIGURATION_CURRENT_STATE',
      actor: { kind: 'SYSTEM' },
      correlationId: randomUUID(),
      media: input.media,
      rollout: input.inventory,
    })
    return input.baselineKind === 'CREATION'
      ? DB.AssessmentAuditRolloutOutcome.ACTIVATED
      : DB.AssessmentAuditRolloutOutcome.ROLLOUT_BASELINED
  } catch {
    return reconcileRolloutFailure({
      ...input,
      reason: 'ASSESSMENT_BASELINE_ACTIVATION_FAILED',
    })
  }
}

export async function activateNewAssessmentAuditIfSelected(input: {
  client: DB.PrismaClient
  liveQuizId: string
  media?: AssessmentAuditMediaDependencies
}): Promise<DB.AssessmentAuditRolloutOutcome | 'NOT_SELECTED'> {
  const config = readAssessmentAuditRolloutConfig()
  if (config.mode !== 'all') return 'NOT_SELECTED'
  const discovered = await discoverAssessmentAuditRolloutCandidates({
    client: input.client,
    liveQuizIds: [input.liveQuizId],
  })
  const candidate = discovered.candidates[0]
  if (candidate === undefined) {
    throw new Error('New assessment is unavailable for audit activation')
  }
  const [inventory] = await beginOrResumeAssessmentAuditRollout({
    client: input.client,
    scanId: randomUUID(),
    observedAt: new Date(),
    candidates: [candidate],
  })
  if (inventory === undefined) {
    throw new Error('New assessment audit inventory was not created')
  }
  return processAssessmentAuditRolloutItem({
    client: input.client,
    candidate,
    inventory,
    media: input.media,
    baselineKind: 'CREATION',
  })
}

export async function assessmentAuditReadiness(input: {
  client: DB.PrismaClient
  liveQuizId: string
}): Promise<'NOT_SELECTED' | 'COVERED' | 'UNCOVERED'> {
  const config = readAssessmentAuditRolloutConfig()
  if (!assessmentIsSelectedForAuditActivation(input.liveQuizId, config)) {
    return 'NOT_SELECTED'
  }
  const latest = await input.client.assessmentAuditScope.findFirst({
    where: { liveQuizId: input.liveQuizId },
    orderBy: { lifecycleEpoch: 'desc' },
    select: { coverageState: true },
  })
  return latest?.coverageState === DB.AssessmentAuditCoverageState.COVERED
    ? 'COVERED'
    : 'UNCOVERED'
}
