import {
  type DurableContext,
  NonRetryableError,
  type UnknownInputType,
} from '@hatchet-dev/typescript-sdk/index.js'
import { hashCanonicalValue, runInAuditTransaction } from '@klicker-uzh/audit'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  Prisma,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
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
  findAcceptedSubmissionBindings,
  findCoveredAssessmentScope,
  getTerminalStageForCommand,
  lockSubmissionOutcome,
  normalizeAssessmentAnswer,
  recordSubmissionMetadataQuarantine,
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
  redis: Pick<ReturnType<typeof getAssessmentRedis>, 'hgetall' | 'hsetnx'>
  now: () => Date
}

function defaultDependencies(): AssessmentProcessorDependencies {
  return {
    client: prisma,
    redis: getAssessmentRedis(),
    now: () => new Date(),
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
  let courseId: string | undefined

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
        courseId,
        recordedAt: dependencies.now(),
        drafts,
      })
    })
  }

  const rejectionDraft = (reasonCode: string) =>
    submissionDraft(message, {
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
    submissionDraft(message, {
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
        await lockSubmissionOutcome(tx, message)
        if (
          (await getTerminalStageForCommand({ tx, message })) ===
          'SUBMISSION_REJECTED'
        )
          throw new NonRetryableError('SUBMISSION_PREVIOUSLY_REJECTED')
        await assertTerminalStageAvailable({
          tx,
          message,
          intendedEventType: 'SUBMISSION_REJECTED',
        })
        const recovered = await commandHasRecordedFailure({
          tx,
          message,
        })
        await emitSubmissionAuditEvents({
          tx,
          auditTx,
          message,
          scope,
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

  const recoverTerminalReplay = async (
    input: Pick<
      Parameters<typeof emitSubmissionAuditEvents>[0],
      'tx' | 'auditTx'
    >
  ) => {
    if (
      coveredScope !== null &&
      (await commandHasRecordedFailure({
        tx: input.tx,
        message,
      }))
    ) {
      await emitSubmissionAuditEvents({
        ...input,
        message,
        scope: coveredScope,
        courseId,
        recordedAt: dependencies.now(),
        drafts: [recoveryDraft()],
      })
    }
  }

  // A command that disagrees with its Hatchet metadata or with the evidence
  // already bound to its submissionId must not record an outcome under that
  // shared identity.
  const quarantine = async (reasonCode: string): Promise<never> => {
    const scope = coveredScope
    if (scope !== null) {
      try {
        await recordSubmissionMetadataQuarantine({
          client: dependencies.client,
          message,
          scope,
          reasonCode,
          recordedAt: dependencies.now(),
        })
      } catch (quarantineError) {
        ctx.logger.error(
          'Assessment submission metadata quarantine was not recorded',
          {
            extra: {
              submissionId: message.submissionId,
              reasonCode,
              quarantineError,
            },
          }
        )
      }
    }
    throw new NonRetryableError(reasonCode)
  }

  try {
    coveredScope = await findCoveredAssessmentScope(
      dependencies.client,
      message.liveQuizId
    )
    const latestScope = coveredScope
    if (latestScope !== null) {
      coveredScope =
        (await findCoveredAssessmentScope(
          dependencies.client,
          message.liveQuizId,
          message.receivedAt
        )) ?? latestScope
    }
    if (coveredScope !== null) {
      if (ctx.additionalMetadata().submissionId !== message.submissionId) {
        await quarantine('SUBMISSION_METADATA_MISMATCH')
      }
      if (
        !Number.isSafeInteger(message.blockExecution) ||
        message.blockExecution < 0
      ) {
        await reject('SUBMISSION_BLOCK_EXECUTION_MISSING')
      }
      let scope = coveredScope
      let submissionReuseReasonCode:
        | 'SUBMISSION_ID_ANSWER_MISMATCH'
        | 'SUBMISSION_ID_SCOPE_MISMATCH'
        | undefined
      await runInAuditTransaction(dependencies.client, async (tx, auditTx) => {
        const answerStateHash = hashCanonicalValue(message.response)
        const previousBindings = await findAcceptedSubmissionBindings({
          tx,
          message,
        })
        const commandBinding = previousBindings[0]
        if (commandBinding !== undefined) {
          scope = { lifecycleEpoch: commandBinding.lifecycleEpoch }
          coveredScope = scope
        }
        const scopeMismatch = previousBindings.some(
          (binding) =>
            binding.participantId !== message.participantId ||
            binding.elementInstanceId !== Number(message.instanceId) ||
            binding.elementBlockExecution !== message.blockExecution ||
            binding.lifecycleEpoch !== scope.lifecycleEpoch
        )
        const answerMismatch = previousBindings.some(
          (binding) => binding.answerStateHash !== answerStateHash
        )
        submissionReuseReasonCode = scopeMismatch
          ? 'SUBMISSION_ID_SCOPE_MISMATCH'
          : answerMismatch
            ? 'SUBMISSION_ID_ANSWER_MISMATCH'
            : undefined
        if (submissionReuseReasonCode === undefined) {
          await emitSubmissionAuditEvents({
            tx,
            auditTx,
            message,
            scope,
            recordedAt: dependencies.now(),
            drafts: [
              submissionDraft(message, {
                eventType: 'SUBMISSION_SERVER_ACCEPTED',
                operationSuffix: 'server-accepted',
                payload: {
                  submissionId: message.submissionId,
                  stage: 'SERVER_ACCEPTED',
                  answerStateHash,
                  elementBlockExecution: message.blockExecution,
                },
              }),
            ],
          })
        }
      })
      if (submissionReuseReasonCode !== undefined) {
        await quarantine(submissionReuseReasonCode)
      }
      if (
        scope.lifecycleEpoch !== latestScope?.lifecycleEpoch ||
        (scope.activatedAt !== undefined &&
          scope.activatedAt !== null &&
          Date.parse(message.receivedAt) < scope.activatedAt.getTime())
      ) {
        const terminal = await getTerminalStageForCommand({
          tx: dependencies.client,
          message,
        })
        if (terminal === 'SUBMISSION_REJECTED')
          throw new NonRetryableError('SUBMISSION_PREVIOUSLY_REJECTED')
        if (terminal !== undefined) {
          await runInAuditTransaction(dependencies.client, (tx, auditTx) =>
            recoverTerminalReplay({ tx, auditTx })
          )
          return { status: 208 }
        }
        await reject('SUBMISSION_LIFECYCLE_CHANGED')
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
      blockStartedAt,
    } = instanceInfo
    courseId = instanceCourseId

    if (
      !Number.isSafeInteger(message.blockExecution) ||
      message.blockExecution < 0 ||
      message.blockExecution !== Number(blockExecution) ||
      (blockStartedAt !== undefined &&
        Date.parse(message.receivedAt) < Number(blockStartedAt))
    ) {
      await reject('SUBMISSION_BLOCK_EXECUTION_CHANGED')
    }

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
      choiceCount: choiceCount === undefined ? undefined : Number(choiceCount),
    })
    if (!validation.valid) {
      await reject(validation.reasonCode)
    }
    const normalizedAnswer = normalizeAssessmentAnswer({
      type: type as ElementType,
      response: message.response,
      restrictions:
        type === ElementType.NUMERICAL
          ? (parsedRestrictions as NumericalRestrictions | undefined)
          : undefined,
    })
    if (coveredScope !== null) {
      await emitStandalone([
        submissionDraft(message, {
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
        await lockSubmissionOutcome(tx, message)
        // Shared locks permit concurrent submissions but serialize them with
        // quiz reset/reopening, which updates this row before deleting answers.
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "LiveQuiz" WHERE id = ${message.liveQuizId}::uuid FOR SHARE`
        )
        const currentScope =
          coveredScope === null
            ? null
            : await findCoveredAssessmentScope(tx, message.liveQuizId)
        const lifecycleChanged =
          coveredScope !== null &&
          currentScope?.lifecycleEpoch !== coveredScope.lifecycleEpoch
        if (lifecycleChanged) {
          const terminal = await getTerminalStageForCommand({
            tx,
            message,
          })
          if (terminal === 'SUBMISSION_REJECTED')
            return {
              kind: 'rejected' as const,
              reasonCode: 'SUBMISSION_PREVIOUSLY_REJECTED',
            }
          if (terminal !== undefined) {
            await recoverTerminalReplay({ tx, auditTx })
            return { kind: 'duplicate' as const }
          }
        }
        const participation = await tx.participation.findUnique({
          where: {
            courseId_participantId: {
              courseId: courseId!,
              participantId: message.participantId,
            },
          },
        })
        const instance = await tx.elementInstance.findUnique({
          where: { id: Number(message.instanceId) },
          select: {
            elementBlock: {
              select: {
                execution: true,
                liveQuizId: true,
                startedAt: true,
                closedAt: true,
              },
            },
          },
        })
        const block = instance?.elementBlock
        let rejectionReason: string | undefined
        if (lifecycleChanged) rejectionReason = 'SUBMISSION_LIFECYCLE_CHANGED'
        // Course participation, not the leaderboard opt-in (isActive), grants
        // assessment access; this matches the running-quiz access check.
        else if (!participation) rejectionReason = 'PARTICIPATION_NOT_FOUND'
        else if (
          block?.liveQuizId !== message.liveQuizId ||
          block.execution !== message.blockExecution ||
          (block.startedAt !== null &&
            block.startedAt.getTime() > Date.parse(message.receivedAt))
        )
          rejectionReason = 'SUBMISSION_BLOCK_EXECUTION_CHANGED'
        else if (
          block.closedAt !== null &&
          Date.parse(message.receivedAt) > block.closedAt.getTime()
        )
          rejectionReason = 'SUBMISSION_AFTER_BLOCK_CLOSE'
        if (rejectionReason !== undefined) {
          if (coveredScope !== null) {
            if (
              (await getTerminalStageForCommand({ tx, message })) ===
              'SUBMISSION_REJECTED'
            )
              return {
                kind: 'rejected' as const,
                reasonCode: 'SUBMISSION_PREVIOUSLY_REJECTED',
              }
            await assertTerminalStageAvailable({
              tx,
              message,
              intendedEventType: 'SUBMISSION_REJECTED',
            })
            const recovered = await commandHasRecordedFailure({
              tx,
              message,
            })
            await emitSubmissionAuditEvents({
              tx,
              auditTx,
              message,
              scope: coveredScope,
              courseId,
              recordedAt: dependencies.now(),
              drafts: [
                rejectionDraft(rejectionReason),
                ...(recovered ? [recoveryDraft()] : []),
              ],
            })
          }
          return {
            kind: 'rejected' as const,
            reasonCode: rejectionReason,
          }
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
        const responseWithSubmissionId = await tx.liveQuizResponse.findUnique({
          where: { submissionId: message.submissionId },
        })
        if (
          responseWithSubmissionId !== null &&
          (responseWithSubmissionId.participantId !== message.participantId ||
            responseWithSubmissionId.instanceId !==
              Number(message.instanceId) ||
            responseWithSubmissionId.elementBlockExecution !==
              Number.parseInt(blockExecution ?? '0', 10) ||
            hashCanonicalValue(responseWithSubmissionId.response) !==
              hashCanonicalValue(message.response))
        ) {
          if (coveredScope !== null) {
            if (
              (await getTerminalStageForCommand({ tx, message })) ===
              'SUBMISSION_REJECTED'
            )
              return {
                kind: 'rejected' as const,
                reasonCode: 'SUBMISSION_PREVIOUSLY_REJECTED',
              }
            await assertTerminalStageAvailable({
              tx,
              message,
              intendedEventType: 'SUBMISSION_REJECTED',
            })
            const recovered = await commandHasRecordedFailure({
              tx,
              message,
            })
            await emitSubmissionAuditEvents({
              tx,
              auditTx,
              message,
              scope: coveredScope,
              courseId,
              recordedAt: dependencies.now(),
              drafts: [
                rejectionDraft('SUBMISSION_ID_SCOPE_MISMATCH'),
                ...(recovered ? [recoveryDraft()] : []),
              ],
            })
          }
          return {
            kind: 'rejected' as const,
            reasonCode: 'SUBMISSION_ID_SCOPE_MISMATCH',
          }
        }
        if (existingResponse) {
          const terminalStage =
            coveredScope === null
              ? undefined
              : await getTerminalStageForCommand({
                  tx,
                  message,
                })
          if (
            existingResponse.submissionId === message.submissionId &&
            hashCanonicalValue(existingResponse.response) ===
              hashCanonicalValue(message.response) &&
            (coveredScope === null || terminalStage === 'SUBMISSION_PERSISTED')
          ) {
            if (coveredScope !== null) {
              const recovered = await commandHasRecordedFailure({
                tx,
                message,
              })
              if (recovered) {
                await emitSubmissionAuditEvents({
                  tx,
                  auditTx,
                  message,
                  scope: coveredScope,
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
              intendedEventType: 'SUBMISSION_DUPLICATE',
            })
            const recovered = await commandHasRecordedFailure({
              tx,
              message,
            })
            await emitSubmissionAuditEvents({
              tx,
              auditTx,
              message,
              scope: coveredScope,
              courseId,
              recordedAt: dependencies.now(),
              drafts: [
                submissionDraft(message, {
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
            intendedEventType: 'SUBMISSION_PERSISTED',
          })
          const recovered = await commandHasRecordedFailure({
            tx,
            message,
          })
          await emitSubmissionAuditEvents({
            tx,
            auditTx,
            message,
            scope: coveredScope,
            courseId,
            recordedAt: dependencies.now(),
            drafts: [
              submissionDraft(message, {
                eventType: 'SUBMISSION_PERSISTED',
                operationSuffix: 'persisted',
                payload: {
                  submissionId: message.submissionId,
                  stage: 'PERSISTED',
                  responseId: createdResponse.id,
                  answer: normalizedAnswer,
                },
              }),
              submissionDraft(message, {
                eventType: 'SUBMISSION_SCORED',
                operationSuffix: 'scored',
                payload: {
                  submissionId: message.submissionId,
                  stage: 'SCORED',
                  responseId: createdResponse.id,
                  answer: normalizedAnswer,
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
      throw new NonRetryableError(transactionResult.reasonCode)
    }
    if (transactionResult.kind === 'duplicate') {
      return { status: 208 }
    }

    await dependencies.redis.hsetnx(
      `${instanceKey}:votes`,
      message.correlationId,
      'accepted'
    )
    const quizInfo = await dependencies.redis.hgetall(`${instanceKey}:info`)
    await ctx.v1.events.push('response-processed:aggregation', {
      correlationId: message.correlationId,
      participantId: message.participantId,
      liveQuizId: message.liveQuizId,
      blockId: sessionBlockId,
      instanceId: message.instanceId,
      blockExecution: message.blockExecution,
      receivedAt: message.receivedAt,
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
      const reasonCode = 'TRANSIENT_PROCESSING_FAILURE'
      try {
        await emitStandalone([
          submissionDraft(message, {
            eventType: 'SUBMISSION_PROCESSING_FAILED',
            operationSuffix: `processing-failed:${ctx.retryCount()}`,
            outcome: reasonCode,
            payload: {
              submissionId: message.submissionId,
              stage: 'PROCESSING_FAILED',
              reasonCode,
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
