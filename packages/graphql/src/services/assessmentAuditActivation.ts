import { randomUUID } from 'node:crypto'
import {
  type AuditActor,
  type AuditEventDraft,
  type AuditMediaSource,
  type AuditTransactionClient,
  AzureBlobAuditMediaSource,
  AzureImmutableAuditMediaStore,
  type BaselinePartPayload,
  type BaselineRootPayload,
  buildAssessmentBaseline,
  canonicalizeJson,
  captureAssessmentMedia,
  createAzureAuditClients,
  createAzureAuditCredential,
  createTrustedAuditContext,
  discoverBaselineMediaReferences,
  emitAuditEvents,
  extractBaselineMediaUrls,
  type ImmutableAuditMediaStore,
  type RolloutBaselinePayload,
  readAzureAuditStorageConfig,
  retentionBatchFor,
  runInAuditTransaction,
} from '@klicker-uzh/audit'
import type { Prisma } from '@klicker-uzh/prisma/client'
import * as DB from '@klicker-uzh/prisma/client'
import {
  type AssessmentBaselineSnapshot,
  assessmentBaselineMarkdown,
  buildAssessmentBaselineContents,
} from './assessmentAuditBaseline.js'

export const ASSESSMENT_AUDIT_QUIZ_SELECT = {
  id: true,
  name: true,
  displayName: true,
  description: true,
  accessMode: true,
  status: true,
  reviewStatus: true,
  availableFrom: true,
  isLiveQAEnabled: true,
  isConfusionFeedbackEnabled: true,
  isModerationEnabled: true,
  isGamificationEnabled: true,
  isAssessmentEnabled: true,
  isDeleted: true,
  areInstancesOutdated: true,
  pointsMultiplier: true,
  defaultPoints: true,
  defaultCorrectPoints: true,
  maxBonusPoints: true,
  timeToZeroBonus: true,
  activeBlockId: true,
  courseId: true,
  blocks: {
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      order: true,
      timeLimit: true,
      expiresAt: true,
      randomSelection: true,
      execution: true,
      status: true,
      startedAt: true,
      closedAt: true,
      elements: {
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          order: true,
          elementId: true,
          isVersionOutdated: true,
          options: true,
          elementData: true,
        },
      },
    },
  },
  course: {
    select: {
      participations: {
        orderBy: { participantId: 'asc' },
        select: { participantId: true, isActive: true },
      },
    },
  },
  permissions: {
    orderBy: { userId: 'asc' },
    select: { userId: true, permissionLevel: true },
  },
} satisfies Prisma.LiveQuizSelect

type BaselineQuizRecord = Prisma.LiveQuizGetPayload<{
  select: typeof ASSESSMENT_AUDIT_QUIZ_SELECT
}>

type BaselineReadClient = Pick<
  Prisma.TransactionClient,
  'liveQuiz' | 'mediaFile' | 'assessmentAuditScope'
>

export type AssessmentAuditMediaDependencies = {
  source: AuditMediaSource
  store: ImmutableAuditMediaStore
  allowedHosts: readonly string[]
}

export type PreparedAssessmentAuditActivation = {
  liveQuizId: string
  lifecycleEpoch: number
  courseId: string | null
  baselineId: string
  baselineKind: BaselineRootPayload['baselineKind']
  capturedAt: string
  recordedAt: string
  activatedAt: string
  snapshotHash: string
  capturedMedia: Parameters<
    typeof buildAssessmentBaselineContents
  >[0]['capturedMedia']
  limitations: Parameters<
    typeof buildAssessmentBaselineContents
  >[0]['limitations']
  root: BaselineRootPayload
  parts: BaselinePartPayload[]
}

export type AssessmentAuditRolloutObservation = {
  scanId: string
  observedAt: string
  observedLifecycleState: RolloutBaselinePayload['observedLifecycleState']
}

function requireEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string
): string {
  const value = environment[name]?.trim()
  if (value === undefined || value === '') {
    throw new Error(`${name} is required for assessment audit activation`)
  }
  return value
}

export function createAssessmentAuditMediaDependencies(
  environment: NodeJS.ProcessEnv = process.env
): AssessmentAuditMediaDependencies {
  const sourceAccountName = requireEnvironmentValue(
    environment,
    'BLOB_STORAGE_ACCOUNT_NAME'
  )
  if (!/^[a-z0-9]{3,24}$/.test(sourceAccountName)) {
    throw new TypeError('BLOB_STORAGE_ACCOUNT_NAME is invalid')
  }
  const allowedHosts = [`${sourceAccountName}.blob.core.windows.net`]
  const credential = createAzureAuditCredential()
  const clients = createAzureAuditClients(
    readAzureAuditStorageConfig(environment),
    credential
  )
  return {
    source: new AzureBlobAuditMediaSource(credential, allowedHosts),
    store: new AzureImmutableAuditMediaStore(clients.blobs.media),
    allowedHosts,
  }
}

function mapQuizRecord(record: BaselineQuizRecord): AssessmentBaselineSnapshot {
  return {
    ...record,
    blocks: record.blocks,
    participations: record.course?.participations ?? [],
    permissions: record.permissions.map((permission) => ({
      ...permission,
      effective: true,
    })),
  }
}

export async function loadAssessmentAuditSnapshot(
  client: Pick<Prisma.TransactionClient, 'liveQuiz'>,
  liveQuizId: string
): Promise<AssessmentBaselineSnapshot | null> {
  const quiz = await client.liveQuiz.findUnique({
    where: { id: liveQuizId },
    select: ASSESSMENT_AUDIT_QUIZ_SELECT,
  })
  return quiz === null ? null : mapQuizRecord(quiz)
}

export async function loadAssessmentBaselineSnapshot(
  client: BaselineReadClient,
  liveQuizId: string
): Promise<AssessmentBaselineSnapshot> {
  const quiz = await loadAssessmentAuditSnapshot(client, liveQuizId)
  if (quiz === null || quiz.isDeleted || !quiz.isAssessmentEnabled) {
    throw new Error('Assessment audit activation requires an active assessment')
  }
  return quiz
}

export async function captureAssessmentAuditSnapshotMedia(input: {
  client: BaselineReadClient
  snapshot: AssessmentBaselineSnapshot
  media: AssessmentAuditMediaDependencies
  capturedAt: Date
}) {
  const markdown = assessmentBaselineMarkdown(input.snapshot)
  const referencedUrls = extractBaselineMediaUrls(markdown)
  const knownMedia =
    referencedUrls.length === 0
      ? []
      : await input.client.mediaFile.findMany({
          where: { href: { in: referencedUrls } },
          select: { id: true, href: true, type: true },
        })
  const discovery = discoverBaselineMediaReferences({
    markdown,
    knownMedia: knownMedia.map((media) => ({
      id: media.id,
      href: media.href,
      mimeType: media.type,
    })),
  })
  const capturedMedia: Array<
    PreparedAssessmentAuditActivation['capturedMedia'][number]
  > = []
  const retainUntil = retentionBatchFor(input.capturedAt)
  for (const reference of discovery.owned) {
    const captured = await captureAssessmentMedia({
      reference,
      source: input.media.source,
      store: input.media.store,
      allowedHosts: input.media.allowedHosts,
      retainUntil,
    })
    capturedMedia.push(captured.media)
  }
  return { capturedMedia, limitations: discovery.limitations }
}

async function prepareAssessmentAuditActivationInternal(input: {
  client: BaselineReadClient
  liveQuizId: string
  baselineKind: BaselineRootPayload['baselineKind']
  media: AssessmentAuditMediaDependencies
  baselineId?: string
  lifecycleEpoch?: number
  capturedAt?: Date
  now?: () => Date
  transformSnapshot?: (
    snapshot: AssessmentBaselineSnapshot
  ) => AssessmentBaselineSnapshot
}): Promise<PreparedAssessmentAuditActivation> {
  const capturedAt = input.capturedAt ?? new Date()
  if (Number.isNaN(capturedAt.getTime())) {
    throw new TypeError('Assessment baseline capture time is invalid')
  }
  const loadedSnapshot = await loadAssessmentBaselineSnapshot(
    input.client,
    input.liveQuizId
  )
  const snapshot = input.transformSnapshot?.(loadedSnapshot) ?? loadedSnapshot
  const latestScope = await input.client.assessmentAuditScope.findFirst({
    where: { liveQuizId: input.liveQuizId },
    orderBy: { lifecycleEpoch: 'desc' },
    select: { lifecycleEpoch: true, coverageState: true },
  })
  if (
    input.baselineKind !== 'REOPENING' &&
    latestScope?.coverageState === DB.AssessmentAuditCoverageState.COVERED
  ) {
    throw new Error('Assessment audit coverage is already active')
  }
  const lifecycleEpoch =
    input.lifecycleEpoch ?? (latestScope?.lifecycleEpoch ?? 0) + 1
  const { capturedMedia, limitations } =
    await captureAssessmentAuditSnapshotMedia({
      client: input.client,
      snapshot,
      media: input.media,
      capturedAt,
    })
  const contents = buildAssessmentBaselineContents({
    snapshot,
    capturedMedia,
    limitations,
  })
  const baselineId = input.baselineId ?? randomUUID()
  const capturedAtIso = capturedAt.toISOString()
  const baseline = buildAssessmentBaseline({
    baselineId,
    baselineKind: input.baselineKind,
    capturedAt: capturedAtIso,
    contents,
  })
  const recordedAt = (input.now ?? (() => new Date()))()
  if (
    Number.isNaN(recordedAt.getTime()) ||
    recordedAt.getTime() < capturedAt.getTime()
  ) {
    throw new TypeError('Assessment baseline recording time is invalid')
  }
  return {
    liveQuizId: input.liveQuizId,
    lifecycleEpoch,
    courseId: snapshot.courseId,
    baselineId,
    baselineKind: input.baselineKind,
    capturedAt: capturedAtIso,
    recordedAt: recordedAt.toISOString(),
    activatedAt: capturedAtIso,
    snapshotHash: baseline.root.aggregateHash,
    capturedMedia,
    limitations,
    ...baseline,
  }
}

export async function prepareAssessmentAuditActivation(input: {
  client: BaselineReadClient
  liveQuizId: string
  baselineKind: BaselineRootPayload['baselineKind']
  media: AssessmentAuditMediaDependencies
  baselineId?: string
  lifecycleEpoch?: number
  capturedAt?: Date
  now?: () => Date
}): Promise<PreparedAssessmentAuditActivation> {
  return prepareAssessmentAuditActivationInternal(input)
}

export async function prepareReopeningAssessmentAuditActivation(input: {
  client: BaselineReadClient
  liveQuizId: string
  media: AssessmentAuditMediaDependencies
  baselineId?: string
  capturedAt?: Date
  now?: () => Date
}): Promise<PreparedAssessmentAuditActivation> {
  return prepareAssessmentAuditActivationInternal({
    ...input,
    baselineKind: 'REOPENING',
    transformSnapshot: (snapshot) => ({
      ...snapshot,
      status: DB.PublicationStatus.DRAFT,
      activeBlockId: null,
      blocks: snapshot.blocks.map((block) => ({
        ...block,
        expiresAt: null,
        execution: block.execution + 1,
        status: DB.ElementBlockStatus.SCHEDULED,
        startedAt: null,
        closedAt: null,
      })),
    }),
  })
}

function activationAuthorization(actor: AuditActor) {
  return actor.kind === 'USER'
    ? {
        decision: 'ALLOWED' as const,
        authScope: 'AS_USER_FULL_ACCESS',
        requiredPermission: 'ADMIN',
      }
    : {
        decision: 'NOT_APPLICABLE' as const,
        authScope: 'SYSTEM_ROLLOUT',
      }
}

export async function persistPreparedAssessmentAuditActivationInTransaction(input: {
  tx: Prisma.TransactionClient
  auditTx: AuditTransactionClient
  prepared: PreparedAssessmentAuditActivation
  actor: Extract<AuditActor, { kind: 'USER' | 'SYSTEM' }>
  correlationId: string
  rollout?: AssessmentAuditRolloutObservation
}) {
  const { tx, auditTx } = input
  const snapshot = await loadAssessmentBaselineSnapshot(
    tx,
    input.prepared.liveQuizId
  )
  const contents = buildAssessmentBaselineContents({
    snapshot,
    capturedMedia: input.prepared.capturedMedia,
    limitations: input.prepared.limitations,
  })
  const rebuilt = buildAssessmentBaseline({
    baselineId: input.prepared.baselineId,
    baselineKind: input.prepared.baselineKind,
    capturedAt: input.prepared.capturedAt,
    contents,
  })
  if (
    rebuilt.root.aggregateHash !== input.prepared.snapshotHash ||
    canonicalizeJson(rebuilt.root) !== canonicalizeJson(input.prepared.root)
  ) {
    throw new Error('Assessment changed while its audit baseline was staged')
  }
  if (input.rollout !== undefined) {
    const inventory =
      await tx.assessmentAuditRolloutInventory.findUniqueOrThrow({
        where: {
          scanId_liveQuizId: {
            scanId: input.rollout.scanId,
            liveQuizId: input.prepared.liveQuizId,
          },
        },
      })
    if (
      inventory.observedAt.toISOString() !== input.rollout.observedAt ||
      inventory.observedLifecycleState !== input.rollout.observedLifecycleState
    ) {
      throw new Error('Assessment audit rollout observation conflict')
    }
  }

  const existing = await tx.assessmentAuditScope.findUnique({
    where: {
      liveQuizId_lifecycleEpoch: {
        liveQuizId: input.prepared.liveQuizId,
        lifecycleEpoch: input.prepared.lifecycleEpoch,
      },
    },
  })
  if (existing === null) {
    await tx.assessmentAuditScope.create({
      data: {
        liveQuizId: input.prepared.liveQuizId,
        lifecycleEpoch: input.prepared.lifecycleEpoch,
        coverageState: DB.AssessmentAuditCoverageState.COVERED,
        baselineId: input.prepared.baselineId,
        baselineKind: input.prepared.baselineKind,
        activatedAt: new Date(input.prepared.activatedAt),
      },
    })
  } else if (
    existing.coverageState !== DB.AssessmentAuditCoverageState.COVERED ||
    existing.baselineId !== input.prepared.baselineId ||
    existing.baselineKind !== input.prepared.baselineKind ||
    existing.activatedAt?.toISOString() !== input.prepared.activatedAt
  ) {
    throw new Error('Assessment audit scope identity conflict')
  }

  const context = createTrustedAuditContext({
    recordedVia: 'TRANSACTIONAL_OUTBOX',
    receivedAt: input.prepared.capturedAt,
    recordedAt: input.prepared.recordedAt,
    actor: input.actor,
    authorization: {
      ...activationAuthorization(input.actor),
      resolvedObjectScope: {
        type: 'LIVE_QUIZ',
        id: input.prepared.liveQuizId,
      },
    },
    scope: {
      liveQuizId: input.prepared.liveQuizId,
      lifecycleEpoch: input.prepared.lifecycleEpoch,
      ...(input.prepared.courseId === null
        ? {}
        : { courseId: input.prepared.courseId }),
    },
    correlationId: input.correlationId,
  })
  const rootDraft: AuditEventDraft<'ASSESSMENT_BASELINE_ROOT_RECORDED'> = {
    eventType: 'ASSESSMENT_BASELINE_ROOT_RECORDED',
    producerOperationId: `${input.prepared.baselineId}:root`,
    payload: input.prepared.root,
  }
  const partDrafts: AuditEventDraft<'ASSESSMENT_BASELINE_PART_RECORDED'>[] =
    input.prepared.parts.map((part) => ({
      eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
      producerOperationId: `${input.prepared.baselineId}:${part.partKey}`,
      payload: part,
    }))
  const activationDraft: AuditEventDraft<'ASSESSMENT_AUDIT_ACTIVATED'> = {
    eventType: 'ASSESSMENT_AUDIT_ACTIVATED',
    producerOperationId: `${input.prepared.baselineId}:activated`,
    payload: {
      baselineId: input.prepared.baselineId,
      baselineKind: input.prepared.baselineKind,
      coverageState: 'COVERED',
      activatedAt: input.prepared.activatedAt,
    },
  }
  const rolloutDraft:
    | AuditEventDraft<'ASSESSMENT_ROLLOUT_BASELINE_RECORDED'>
    | undefined =
    input.rollout === undefined
      ? undefined
      : {
          eventType: 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED',
          producerOperationId: `${input.rollout.scanId}:${input.prepared.liveQuizId}:terminal`,
          payload: {
            scanId: input.rollout.scanId,
            observedAt: input.rollout.observedAt,
            observedLifecycleState: input.rollout.observedLifecycleState,
            lifecycleEpoch: input.prepared.lifecycleEpoch,
            outcome:
              input.prepared.baselineKind === 'CREATION'
                ? 'ACTIVATED'
                : 'ROLLOUT_BASELINED',
            coverageState: 'COVERED',
            baselineId: input.prepared.baselineId,
            terminalAt: null,
            retentionAnchorAt: null,
            reasonCode: null,
          },
        }
  const events = await emitAuditEvents(auditTx, context, [
    rootDraft,
    ...partDrafts,
    activationDraft,
    ...(rolloutDraft === undefined ? [] : [rolloutDraft]),
  ])
  if (input.rollout !== undefined) {
    const rolloutEvent = events.at(-1)
    if (rolloutEvent === undefined) {
      throw new Error('Assessment audit rollout event was not emitted')
    }
    const outcome =
      input.prepared.baselineKind === 'CREATION'
        ? DB.AssessmentAuditRolloutOutcome.ACTIVATED
        : DB.AssessmentAuditRolloutOutcome.ROLLOUT_BASELINED
    const updated = await tx.assessmentAuditRolloutInventory.updateMany({
      where: {
        scanId: input.rollout.scanId,
        liveQuizId: input.prepared.liveQuizId,
        outcome: DB.AssessmentAuditRolloutOutcome.PENDING,
      },
      data: {
        outcome,
        rolloutEventId: rolloutEvent.eventId,
      },
    })
    if (updated.count === 0) {
      const existingInventory =
        await tx.assessmentAuditRolloutInventory.findUnique({
          where: {
            scanId_liveQuizId: {
              scanId: input.rollout.scanId,
              liveQuizId: input.prepared.liveQuizId,
            },
          },
        })
      if (
        existingInventory?.outcome !== outcome ||
        existingInventory.rolloutEventId !== rolloutEvent.eventId
      ) {
        throw new Error('Assessment audit rollout inventory conflict')
      }
    }
  }
  return {
    liveQuizId: input.prepared.liveQuizId,
    lifecycleEpoch: input.prepared.lifecycleEpoch,
    baselineId: input.prepared.baselineId,
    eventIds: events.map((event) => event.eventId),
  }
}

export async function persistPreparedAssessmentAuditActivation(input: {
  client: Pick<DB.PrismaClient, '$transaction'>
  prepared: PreparedAssessmentAuditActivation
  actor: Extract<AuditActor, { kind: 'USER' | 'SYSTEM' }>
  correlationId: string
  rollout?: AssessmentAuditRolloutObservation
}) {
  return runInAuditTransaction(input.client, (tx, auditTx) =>
    persistPreparedAssessmentAuditActivationInTransaction({
      tx,
      auditTx,
      prepared: input.prepared,
      actor: input.actor,
      correlationId: input.correlationId,
      ...(input.rollout === undefined ? {} : { rollout: input.rollout }),
    })
  )
}

export type AssessmentAuditRolloutConfig =
  | { mode: 'disabled'; pilotLiveQuizIds: ReadonlySet<string> }
  | { mode: 'pilot'; pilotLiveQuizIds: ReadonlySet<string> }
  | { mode: 'all'; pilotLiveQuizIds: ReadonlySet<string> }

export function readAssessmentAuditRolloutConfig(
  environment: NodeJS.ProcessEnv = process.env
): AssessmentAuditRolloutConfig {
  const value = environment.ASSESSMENT_AUDIT_ROLLOUT?.trim() || 'disabled'
  if (!['disabled', 'pilot', 'all'].includes(value)) {
    throw new TypeError(
      'ASSESSMENT_AUDIT_ROLLOUT must be disabled, pilot, or all'
    )
  }
  const pilotLiveQuizIds = new Set(
    (environment.ASSESSMENT_AUDIT_PILOT_LIVE_QUIZ_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  )
  for (const id of pilotLiveQuizIds) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      throw new TypeError('Assessment audit pilot LiveQuiz ID is invalid')
    }
  }
  if (value === 'pilot' && pilotLiveQuizIds.size === 0) {
    throw new Error(
      'ASSESSMENT_AUDIT_PILOT_LIVE_QUIZ_IDS is required in pilot mode'
    )
  }
  return {
    mode: value as AssessmentAuditRolloutConfig['mode'],
    pilotLiveQuizIds,
  }
}

export function assessmentIsSelectedForAuditActivation(
  liveQuizId: string,
  config: AssessmentAuditRolloutConfig
): boolean {
  return (
    config.mode === 'all' ||
    (config.mode === 'pilot' && config.pilotLiveQuizIds.has(liveQuizId))
  )
}

export async function activateAssessmentAudit(input: {
  client: DB.PrismaClient
  liveQuizId: string
  baselineKind: BaselineRootPayload['baselineKind']
  actor: Extract<AuditActor, { kind: 'USER' | 'SYSTEM' }>
  correlationId?: string
  media?: AssessmentAuditMediaDependencies
  baselineId?: string
  lifecycleEpoch?: number
  capturedAt?: Date
  rollout?: AssessmentAuditRolloutObservation
}) {
  const prepared = await prepareAssessmentAuditActivation({
    client: input.client,
    liveQuizId: input.liveQuizId,
    baselineKind: input.baselineKind,
    media: input.media ?? createAssessmentAuditMediaDependencies(),
    baselineId: input.baselineId,
    lifecycleEpoch: input.lifecycleEpoch,
    capturedAt: input.capturedAt,
  })
  return persistPreparedAssessmentAuditActivation({
    client: input.client,
    prepared,
    actor: input.actor,
    correlationId: input.correlationId ?? randomUUID(),
    rollout: input.rollout,
  })
}
