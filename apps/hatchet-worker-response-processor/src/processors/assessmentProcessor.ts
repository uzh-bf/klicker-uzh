import {
  type DurableContext,
  NonRetryableError,
  type UnknownInputType,
} from '@hatchet-dev/typescript-sdk/index.js'
import { hashCanonicalValue, runInAuditTransaction } from '@klicker-uzh/audit'
import { prisma } from '@klicker-uzh/prisma'
import { ElementType, ResponseCorrectness } from '@klicker-uzh/prisma/client'
import type {
  AssessmentResponseCommand,
  FreeTextRestrictions,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import { DEFAULT_POINTS } from '../constants.js'
import { getAssessmentRedis } from '../redis.js'
import {
  ASSESSMENT_SCORING_ALGORITHM_VERSION,
  ASSESSMENT_VALIDATION_RULES_VERSION,
  assertTerminalStageAvailable,
  type CoveredAssessmentScope,
  commandHasRecordedFailure,
  emitSubmissionAuditEvents,
  findAcceptedAnswerHashes,
  findCoveredAssessmentScope,
  getTerminalStageForCommand,
  submissionDraft,
} from './assessmentAudit.js'
import {
  getCaseStudyQuestionPointsDetails,
  getChoicesQuestionPointsDetails,
  getFreeTextQuestionPointsDetails,
  getNumericalQuestionPointsDetails,
  getSelectionQuestionPointsDetails,
  validateStudentResponse,
} from './helpers.js'

type AssessmentCommand = AssessmentResponseCommand<LiveQuizResponseInput>
type AssessmentContext = DurableContext<UnknownInputType, {}>

type AssessmentProcessorDependencies = {
  client: typeof prisma
  redis: Pick<
    ReturnType<typeof getAssessmentRedis>,
    'hgetall' | 'hset' | 'hsetnx'
  >
  now: () => Date
  resolveHatchetEventId: (
    message: AssessmentCommand,
    ctx: AssessmentContext
  ) => Promise<string>
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export async function resolveTriggeringHatchetEventId(
  message: AssessmentCommand,
  ctx: AssessmentContext
) {
  const metadata = ctx.additionalMetadata()
  if (metadata.submissionId !== message.submissionId) {
    throw new NonRetryableError('SUBMISSION_METADATA_MISMATCH')
  }
  const workflowRunId = ctx.workflowRunId()
  for (let attempt = 0; attempt < 3; attempt++) {
    const events = await ctx.v1.events.list({
      limit: 10,
      workflowIds: [workflowRunId],
    })
    const candidates = (events.rows ?? []).filter((event) =>
      event.triggeredRuns?.some((run) => run.workflowRunId === workflowRunId)
    )
    if (candidates.length === 1) {
      const eventId = candidates[0]?.metadata.id
      if (typeof eventId === 'string' && eventId !== '') return eventId
    }
    if (candidates.length > 1) {
      throw new Error('Hatchet workflow run has multiple triggering events')
    }
    await sleep(50 * (attempt + 1))
  }
  throw new Error('Hatchet triggering event is not yet available')
}

function defaultDependencies(): AssessmentProcessorDependencies {
  return {
    client: prisma,
    redis: getAssessmentRedis(),
    now: () => new Date(),
    resolveHatchetEventId: resolveTriggeringHatchetEventId,
  }
}

function correctnessFromScore(score: number | null) {
  return score === null || score === 1
    ? ResponseCorrectness.CORRECT
    : score === 0
      ? ResponseCorrectness.WRONG
      : ResponseCorrectness.PARTIAL
}

export async function processAssessmentResponse(
  message: AssessmentCommand,
  ctx: AssessmentContext,
  dependencies: AssessmentProcessorDependencies = defaultDependencies()
) {
  if (message.liveQuizId === 'ping') {
    if (process.env.FUNCTION_HEARTBEAT_URL) {
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }
    return { status: 200 }
  }

  let coveredScope: CoveredAssessmentScope | null = null
  let hatchetEventId: string | null = null
  let courseId: string | undefined

  const requireHatchetEventId = () => {
    if (hatchetEventId === null) {
      throw new Error('Covered submission has no Hatchet event ID')
    }
    return hatchetEventId
  }

  const emitStandalone = async (
    drafts: Parameters<typeof emitSubmissionAuditEvents>[0]['drafts']
  ) => {
    const scope = coveredScope
    if (scope === null) return
    await runInAuditTransaction(dependencies.client, async (tx, auditTx) => {
      await emitSubmissionAuditEvents({
        tx,
        auditTx,
        message,
        scope,
        hatchetEventId: requireHatchetEventId(),
        courseId,
        recordedAt: dependencies.now(),
        drafts,
      })
    })
  }

  const rejectionDraft = (reasonCode: string) =>
    submissionDraft(message, requireHatchetEventId(), {
      eventType: 'SUBMISSION_REJECTED',
      operationSuffix: 'rejected',
      outcome: reasonCode,
      payload: {
        submissionId: message.submissionId,
        stage: 'REJECTED',
        reasonCode,
      },
    })

  const recoveryDraft = () =>
    submissionDraft(message, requireHatchetEventId(), {
      eventType: 'SUBMISSION_PROCESSING_RECOVERED',
      operationSuffix: 'processing-recovered',
      payload: {
        submissionId: message.submissionId,
        stage: 'PROCESSING_RECOVERED',
      },
    })

  const reject = async (reasonCode: string): Promise<never> => {
    const scope = coveredScope
    if (scope !== null) {
      await runInAuditTransaction(dependencies.client, async (tx, auditTx) => {
        await assertTerminalStageAvailable({
          tx,
          message,
          hatchetEventId: requireHatchetEventId(),
          intendedEventType: 'SUBMISSION_REJECTED',
        })
        const recovered = await commandHasRecordedFailure({
          tx,
          message,
          hatchetEventId: requireHatchetEventId(),
        })
        await emitSubmissionAuditEvents({
          tx,
          auditTx,
          message,
          scope,
          hatchetEventId: requireHatchetEventId(),
          courseId,
          recordedAt: dependencies.now(),
          drafts: [
            rejectionDraft(reasonCode),
            ...(recovered ? [recoveryDraft()] : []),
          ],
        })
      })
    }
    throw new NonRetryableError(reasonCode)
  }

  try {
    coveredScope = await findCoveredAssessmentScope(
      dependencies.client,
      message.liveQuizId
    )
    if (coveredScope !== null) {
      hatchetEventId = await dependencies.resolveHatchetEventId(message, ctx)
      const scope = coveredScope
      let reusedWithDifferentAnswer = false
      await runInAuditTransaction(dependencies.client, async (tx, auditTx) => {
        const answerStateHash = hashCanonicalValue(message.response)
        const previousHashes = await findAcceptedAnswerHashes({ tx, message })
        reusedWithDifferentAnswer = [...previousHashes].some(
          (hash) => hash !== answerStateHash
        )
        await emitSubmissionAuditEvents({
          tx,
          auditTx,
          message,
          scope,
          hatchetEventId: requireHatchetEventId(),
          recordedAt: dependencies.now(),
          drafts: [
            submissionDraft(message, requireHatchetEventId(), {
              eventType: 'SUBMISSION_SERVER_ACCEPTED',
              operationSuffix: 'server-accepted',
              payload: {
                submissionId: message.submissionId,
                stage: 'SERVER_ACCEPTED',
                answerStateHash,
              },
            }),
          ],
        })
      })
      if (reusedWithDifferentAnswer) {
        await reject('SUBMISSION_ID_ANSWER_MISMATCH')
      }
    }

    const liveQuizKey = `lq:${message.liveQuizId}`
    const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
    const instanceInfo = await dependencies.redis.hgetall(`${instanceKey}:info`)
    if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
      throw new Error('ASSESSMENT_INSTANCE_METADATA_UNAVAILABLE')
    }

    const {
      type,
      solutions,
      restrictions,
      firstResponseReceivedAt,
      sessionBlockId,
      courseId: instanceCourseId,
      choiceCount,
      basePoints,
      defaultPoints,
      pointsMultiplier,
      blockExecution,
      blockClosedAt,
    } = instanceInfo
    courseId = instanceCourseId

    if (!message.response && type !== ElementType.CONTENT) {
      await reject('RESPONSE_MISSING')
    }
    if (!type || !courseId || !sessionBlockId) {
      await reject('INSTANCE_CONFIGURATION_INVALID')
    }
    if (
      blockClosedAt &&
      Number(message.responseTimestamp) > Number(blockClosedAt)
    ) {
      await reject('SUBMISSION_AFTER_BLOCK_CLOSE')
    }

    let parsedRestrictions:
      | NumericalRestrictions
      | FreeTextRestrictions
      | undefined
    try {
      parsedRestrictions = restrictions
        ? typeof restrictions === 'string'
          ? JSON.parse(restrictions)
          : restrictions
        : undefined
    } catch {
      await reject('RESTRICTIONS_CONFIGURATION_INVALID')
    }

    const validation = validateStudentResponse({
      type: type as
        | 'SC'
        | 'MC'
        | 'KPRIM'
        | 'NUMERICAL'
        | 'FREE_TEXT'
        | 'SELECTION'
        | 'CASE_STUDY'
        | 'CONTENT',
      response: message.response,
      restrictions: parsedRestrictions,
    })
    if (!validation.valid) {
      await reject(validation.reasonCode)
    }
    if (coveredScope !== null) {
      await emitStandalone([
        submissionDraft(message, requireHatchetEventId(), {
          eventType: 'SUBMISSION_VALIDATED',
          operationSuffix: 'validated',
          payload: {
            submissionId: message.submissionId,
            stage: 'VALIDATED',
            validationRulesVersion: ASSESSMENT_VALIDATION_RULES_VERSION,
          },
        }),
      ])
    }

    let parsedSolutions: unknown
    try {
      parsedSolutions = solutions ? JSON.parse(solutions) : undefined
    } catch {
      await reject('SOLUTIONS_CONFIGURATION_INVALID')
    }

    const awardedBasePoints =
      basePoints === 'true'
        ? Number.parseInt(defaultPoints ?? String(DEFAULT_POINTS), 10)
        : 0
    let computedCorrectness: number | null = null
    let awardedCorrectnessPoints = 0
    let awardedBonusPoints = 0
    let awardedXp = 0

    switch (type) {
      case ElementType.SC:
      case ElementType.MC:
      case ElementType.KPRIM: {
        if (!message.response.choices) await reject('CHOICES_MISSING')
        const result = getChoicesQuestionPointsDetails({
          type,
          choiceCount,
          response: message.response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp: message.responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
        computedCorrectness = result.pointsPercentage
        awardedCorrectnessPoints = result.correctnessPoints
        awardedBonusPoints = result.bonusPoints
        awardedXp = result.xpAwarded
        break
      }
      case ElementType.NUMERICAL: {
        if (message.response.value == null) await reject('VALUE_MISSING')
        const result = getNumericalQuestionPointsDetails({
          response: message.response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp: message.responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
        computedCorrectness = result.pointsPercentage
        awardedCorrectnessPoints = result.correctnessPoints
        awardedBonusPoints = result.bonusPoints
        awardedXp = result.xpAwarded
        break
      }
      case ElementType.FREE_TEXT: {
        if (typeof message.response.value !== 'string') {
          await reject('VALUE_MISSING')
        }
        const result = getFreeTextQuestionPointsDetails({
          response: message.response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp: message.responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
        computedCorrectness = result.pointsPercentage
        awardedCorrectnessPoints = result.correctnessPoints
        awardedBonusPoints = result.bonusPoints
        awardedXp = result.xpAwarded
        break
      }
      case ElementType.SELECTION: {
        if (!message.response.selection) await reject('SELECTION_MISSING')
        const result = getSelectionQuestionPointsDetails({
          response: message.response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp: message.responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
        computedCorrectness = result.pointsPercentage
        awardedCorrectnessPoints = result.correctnessPoints
        awardedBonusPoints = result.bonusPoints
        awardedXp = result.xpAwarded
        break
      }
      case ElementType.CASE_STUDY: {
        if (!message.response.assessment) await reject('ASSESSMENT_MISSING')
        const result = getCaseStudyQuestionPointsDetails({
          response: message.response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp: message.responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
        computedCorrectness = result.pointsPercentage
        awardedCorrectnessPoints = result.correctnessPoints
        awardedBonusPoints = result.bonusPoints
        awardedXp = result.xpAwarded
        break
      }
      case ElementType.CONTENT:
        break
      default:
        await reject('ELEMENT_TYPE_UNSUPPORTED')
    }

    if (computedCorrectness === 1 && firstResponseReceivedAt === undefined) {
      await dependencies.redis.hsetnx(
        `${instanceKey}:info`,
        'firstResponseReceivedAt',
        message.responseTimestamp
      )
    }

    const storedCorrectness = correctnessFromScore(computedCorrectness)
    const transactionResult = await runInAuditTransaction(
      dependencies.client,
      async (tx, auditTx) => {
        const participation = await tx.participation.findUnique({
          where: {
            courseId_participantId: {
              courseId: courseId!,
              participantId: message.participantId,
            },
          },
        })
        if (!participation) {
          if (coveredScope !== null) {
            await assertTerminalStageAvailable({
              tx,
              message,
              hatchetEventId: requireHatchetEventId(),
              intendedEventType: 'SUBMISSION_REJECTED',
            })
            const recovered = await commandHasRecordedFailure({
              tx,
              message,
              hatchetEventId: requireHatchetEventId(),
            })
            await emitSubmissionAuditEvents({
              tx,
              auditTx,
              message,
              scope: coveredScope,
              hatchetEventId: requireHatchetEventId(),
              courseId,
              recordedAt: dependencies.now(),
              drafts: [
                rejectionDraft('PARTICIPATION_NOT_FOUND'),
                ...(recovered ? [recoveryDraft()] : []),
              ],
            })
          }
          return { kind: 'rejected' as const }
        }

        const existingResponse = await tx.liveQuizResponse.findUnique({
          where: {
            instanceId_elementBlockExecution_participantId: {
              instanceId: Number(message.instanceId),
              elementBlockExecution: Number.parseInt(blockExecution ?? '0', 10),
              participantId: message.participantId,
            },
          },
        })
        if (existingResponse) {
          const terminalStage =
            coveredScope === null
              ? undefined
              : await getTerminalStageForCommand({
                  tx,
                  message,
                  hatchetEventId: requireHatchetEventId(),
                })
          if (
            existingResponse.submissionId === message.submissionId &&
            terminalStage === 'SUBMISSION_PERSISTED'
          ) {
            if (coveredScope !== null) {
              const recovered = await commandHasRecordedFailure({
                tx,
                message,
                hatchetEventId: requireHatchetEventId(),
              })
              if (recovered) {
                await emitSubmissionAuditEvents({
                  tx,
                  auditTx,
                  message,
                  scope: coveredScope,
                  hatchetEventId: requireHatchetEventId(),
                  courseId,
                  recordedAt: dependencies.now(),
                  drafts: [recoveryDraft()],
                })
              }
            }
            return {
              kind: 'persisted' as const,
              responseId: existingResponse.id,
            }
          }
          if (terminalStage === 'SUBMISSION_DUPLICATE') {
            return { kind: 'duplicate' as const }
          }
          if (coveredScope !== null) {
            await assertTerminalStageAvailable({
              tx,
              message,
              hatchetEventId: requireHatchetEventId(),
              intendedEventType: 'SUBMISSION_DUPLICATE',
            })
            const recovered = await commandHasRecordedFailure({
              tx,
              message,
              hatchetEventId: requireHatchetEventId(),
            })
            await emitSubmissionAuditEvents({
              tx,
              auditTx,
              message,
              scope: coveredScope,
              hatchetEventId: requireHatchetEventId(),
              courseId,
              recordedAt: dependencies.now(),
              drafts: [
                submissionDraft(message, requireHatchetEventId(), {
                  eventType: 'SUBMISSION_DUPLICATE',
                  operationSuffix: 'duplicate',
                  payload: {
                    submissionId: message.submissionId,
                    stage: 'DUPLICATE',
                    duplicateOfResponseId: existingResponse.id,
                  },
                }),
                ...(recovered ? [recoveryDraft()] : []),
              ],
            })
          }
          return { kind: 'duplicate' as const }
        }

        const createdResponse = await tx.liveQuizResponse.create({
          data: {
            submissionId: message.submissionId,
            submittedAt: new Date(message.responseTimestamp),
            response: message.response,
            timeSpent: -1,
            correctness: storedCorrectness,
            basePoints: Number.isNaN(awardedBasePoints) ? 0 : awardedBasePoints,
            correctnessPoints: Number.isNaN(awardedCorrectnessPoints)
              ? 0
              : awardedCorrectnessPoints,
            bonusPoints: Number.isNaN(awardedBonusPoints)
              ? 0
              : awardedBonusPoints,
            elementBlockExecution: Number.parseInt(blockExecution ?? '0', 10),
            instance: { connect: { id: Number(message.instanceId) } },
            participant: { connect: { id: message.participantId } },
          },
        })
        if (coveredScope !== null) {
          await assertTerminalStageAvailable({
            tx,
            message,
            hatchetEventId: requireHatchetEventId(),
            intendedEventType: 'SUBMISSION_PERSISTED',
          })
          const recovered = await commandHasRecordedFailure({
            tx,
            message,
            hatchetEventId: requireHatchetEventId(),
          })
          await emitSubmissionAuditEvents({
            tx,
            auditTx,
            message,
            scope: coveredScope,
            hatchetEventId: requireHatchetEventId(),
            courseId,
            recordedAt: dependencies.now(),
            drafts: [
              submissionDraft(message, requireHatchetEventId(), {
                eventType: 'SUBMISSION_PERSISTED',
                operationSuffix: 'persisted',
                payload: {
                  submissionId: message.submissionId,
                  stage: 'PERSISTED',
                  responseId: createdResponse.id,
                },
              }),
              submissionDraft(message, requireHatchetEventId(), {
                eventType: 'SUBMISSION_SCORED',
                operationSuffix: 'scored',
                payload: {
                  submissionId: message.submissionId,
                  stage: 'SCORED',
                  responseId: createdResponse.id,
                  scoringAlgorithmVersion: ASSESSMENT_SCORING_ALGORITHM_VERSION,
                  correctness: storedCorrectness,
                  basePoints: createdResponse.basePoints,
                  correctnessPoints: createdResponse.correctnessPoints,
                  bonusPoints: createdResponse.bonusPoints,
                },
              }),
              ...(recovered ? [recoveryDraft()] : []),
            ],
          })
        }
        return { kind: 'persisted' as const, responseId: createdResponse.id }
      }
    )

    if (transactionResult.kind === 'rejected') {
      throw new NonRetryableError('PARTICIPATION_NOT_FOUND')
    }
    if (transactionResult.kind === 'duplicate') {
      return { status: 208 }
    }

    await dependencies.redis.hset(
      `${instanceKey}:votes`,
      message.correlationId,
      'true'
    )
    const quizInfo = await dependencies.redis.hgetall(`${instanceKey}:info`)
    await ctx.v1.events.push('response-processed:aggregation', {
      correlationId: message.correlationId,
      participantId: message.participantId,
      liveQuizId: message.liveQuizId,
      blockId: sessionBlockId,
      instanceId: message.instanceId,
      elementType: type,
      isGamificationEnabled: quizInfo.isGamificationEnabled === 'true',
      pointsAwarded: awardedBasePoints,
      xpAwarded: awardedXp,
      response: message.response,
    })

    return {
      status: 200,
      responseId: transactionResult.responseId,
      pointsAwarded: awardedBasePoints,
      correctnessPoints: awardedCorrectnessPoints,
      bonusPoints: awardedBonusPoints,
      xpAwarded: awardedXp,
    }
  } catch (error) {
    if (error instanceof NonRetryableError) throw error
    if (coveredScope !== null) {
      try {
        await emitStandalone([
          submissionDraft(message, requireHatchetEventId(), {
            eventType: 'SUBMISSION_PROCESSING_FAILED',
            operationSuffix: `processing-failed:${ctx.retryCount()}`,
            outcome: 'TRANSIENT_PROCESSING_FAILURE',
            payload: {
              submissionId: message.submissionId,
              stage: 'PROCESSING_FAILED',
              reasonCode: 'TRANSIENT_PROCESSING_FAILURE',
            },
          }),
        ])
      } catch {
        ctx.logger.error(
          'Assessment submission failure evidence was not recorded',
          {
            extra: {
              submissionId: message.submissionId,
              retryCount: ctx.retryCount(),
            },
          }
        )
      }
    }
    ctx.logger.error('Assessment submission processing will retry', {
      extra: {
        submissionId: message.submissionId,
        retryCount: ctx.retryCount(),
      },
    })
    throw error
  }
}
