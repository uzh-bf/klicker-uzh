import { ApolloError, useMutation } from '@apollo/client'
import {
  CaseStudyCaseResponse,
  ElementStack,
  ElementType,
  GroupActivityDecision,
  GroupActivityDetailsDocument,
  GroupActivityResults,
  RequestEscapeRoomHintDocument,
  ResponseCorrectnessType,
  SelectionElementData,
  SkipEscapeRoomStageDocument,
  SubmitGroupActivityDecisionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  CaseStudyStudentResponseType,
  StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import getEmptySelectionResponse from '@klicker-uzh/shared-components/src/utils/getEmptySelectionResponse'
import { ChoicesResponse } from '@klicker-uzh/types'
import { Button, UserNotification, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useStackElementFeedbacks from '../hooks/useStackElementFeedbacks'
import EscapeRoomSkipButton from '../practiceQuiz/EscapeRoomSkipButton'
import InstanceHeader from '../practiceQuiz/InstanceHeader'

interface GroupActivityStackProps {
  activityId: number
  activityEnded: boolean
  stack: ElementStack
  decisions?: GroupActivityDecision[] | null
  stageDecisions?: GroupActivityDecision[] | null
  results?: GroupActivityResults | null
  submittedAt?: string
  groupActivityId?: string
  groupId?: string
  hintPenalty?: number
  // Scoring rules and attempt state of a group escape room. Penalties only
  // count toward the ranked time, never the countdown.
  escapeRoomRules?: {
    hintPenalties: number[]
    maxWrongAttempts?: number | null
    revealPenalty: number
    skipPenalty?: number | null
    stageOutcomes: {
      stageKey: string
      wrongAttempts: number
      outcome?: string | null
    }[]
    attemptInProgress: boolean
    // the bonus stage (last response element), if the rules grant one
    bonusInstanceId?: number
    // the bonus stage can be answered now, after the attempt completed
    bonusOpen: boolean
  }
  onEscapeRoomStateChanged?: () => Promise<unknown> | void
}

export function isGroupEscapeRoomResponseType(type: ElementType) {
  return [
    ElementType.Sc,
    ElementType.Mc,
    ElementType.Kprim,
    ElementType.Numerical,
    ElementType.FreeText,
    ElementType.Selection,
    ElementType.CaseStudy,
    ElementType.QrScan,
  ].includes(type)
}

function GroupActivityStack({
  activityId,
  activityEnded,
  stack,
  decisions,
  stageDecisions,
  results,
  submittedAt,
  groupActivityId,
  groupId,
  hintPenalty = 0,
  escapeRoomRules,
  onEscapeRoomStateChanged,
}: GroupActivityStackProps) {
  const t = useTranslations()
  const router = useRouter()

  const [submitGroupActivityDecisions, { loading: submitLoading }] =
    useMutation(SubmitGroupActivityDecisionsDocument, {
      // previous submissions need to be loaded in the correct format
      // duplication of logic for rarely called function is probably not worth it
      refetchQueries: [
        {
          query: GroupActivityDetailsDocument,
          variables: {
            groupId: router.query.groupId,
            activityId: router.query.activityId,
          },
        },
      ],
    })
  const [requestEscapeRoomHint, { loading: hintLoading }] = useMutation(
    RequestEscapeRoomHintDocument
  )
  const [skipEscapeRoomStage, { loading: skipLoading }] = useMutation(
    SkipEscapeRoomStageDocument
  )
  const [revealedHints, setRevealedHints] = useState<Record<number, string[]>>(
    {}
  )
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const elementFeedbacks = useStackElementFeedbacks({
    instanceIds: stack.elements?.map((element) => element.id) ?? [],
    withParticipant: true,
  })

  const [studentResponse, setStudentResponse] =
    useState<StackStudentResponseType>({})

  useStudentResponse({
    stack,
    currentStep: 0,
    setStudentResponse,
    defaultRead: true,
  })

  // Escape-room group activities unlock one response element (stage) at a
  // time; cleared stages stay visible read-only with the team's answer.
  // The bonus stage stays answerable after completion, when the instance
  // already carries its decisions.
  const isBonusPhase = !!escapeRoomRules?.bonusOpen
  const isStagedEscapeRoom = !!groupActivityId && (!decisions || isBonusPhase)
  // Revealed and skipped stages have no team answer, so they only show up in
  // the stage outcomes.
  const clearedStageIds = new Set([
    ...(stageDecisions ?? []).map((decision) => decision.instanceId),
    ...(escapeRoomRules?.stageOutcomes ?? [])
      .filter(
        (entry) => entry.outcome === 'REVEALED' || entry.outcome === 'SKIPPED'
      )
      .map((entry) => Number(entry.stageKey)),
  ])
  const currentStageId = isStagedEscapeRoom
    ? stack.elements?.find(
        (element) =>
          isGroupEscapeRoomResponseType(element.elementType) &&
          !clearedStageIds.has(element.id)
      )?.id
    : undefined

  useEffect(() => {
    const loadedDecisions =
      decisions ?? (groupActivityId ? stageDecisions : undefined)
    const loadedResponses = loadedDecisions?.reduce<StackStudentResponseType>(
      (acc, decision) => {
        if (!decision) return acc

        if (
          decision.type === ElementType.Sc ||
          decision.type === ElementType.Mc
        ) {
          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.choicesResponse?.reduce<Record<number, boolean>>(
              (acc, choice) => ({ ...acc, [choice.ix]: true }),
              {}
            ),
            valid: true,
          }
          return acc
        } else if (decision.type === ElementType.Kprim) {
          const responseObj = Array.from({ length: 4 }, (_, i) => i).reduce<
            Record<number, boolean>
          >((acc, choice) => ({ ...acc, [choice]: false }), {})

          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.choicesResponse?.reduce<Record<number, boolean>>(
              (acc, choice) => ({ ...acc, [choice.ix]: true }),
              responseObj
            ),
            valid: true,
          }
          return acc
        } else if (decision.type === ElementType.Numerical) {
          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.numericalResponse
              ? String(decision.numericalResponse)
              : undefined,
            valid: true,
          }
          return acc
        } else if (decision.type === ElementType.FreeText) {
          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.freeTextResponse ?? undefined,
            valid: true,
          }
          return acc
        } else if (decision.type === ElementType.Selection) {
          const instance = stack.elements?.find(
            (element) => element.id === decision.instanceId
          )
          const response = getEmptySelectionResponse({
            numberOfInputs: instance
              ? (instance.elementData as SelectionElementData).options
                  .numberOfInputs
              : 1,
          })
          decision.selectionResponse
            ? decision.selectionResponse.forEach((answerId, ix) => {
                response[ix] = answerId
              })
            : undefined

          acc[decision.instanceId] = {
            type: decision.type,
            response,
            valid: true,
          }
          return acc
        } else if (decision.type === ElementType.CaseStudy) {
          const decisionsObject =
            decision.caseStudyResponse?.reduce<CaseStudyStudentResponseType>(
              (caseAcc, caseItem) => {
                caseAcc[caseItem.caseId] = caseItem.itemResponses.reduce<
                  CaseStudyStudentResponseType['']
                >((itemAcc, item) => {
                  itemAcc[String(item.itemId)] = item.criterionResponses.reduce<
                    CaseStudyStudentResponseType['']['']
                  >((criterionAcc, criterion) => {
                    criterionAcc[criterion.criterionId] = criterion.response
                    return criterionAcc
                  }, {})
                  return itemAcc
                }, {})
                return caseAcc
              },
              {}
            )

          acc[decision.instanceId] = {
            type: decision.type,
            response: decisionsObject ?? undefined,
            valid: true,
          }
          return acc
        } else if (decision.type === ElementType.Content) {
          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.contentResponse ?? undefined,
            valid: true,
          }
          return acc
        }

        return acc
      },
      {}
    )

    setStudentResponse((prev) =>
      loadedResponses
        ? decisions && !isBonusPhase
          ? loadedResponses
          : { ...prev, ...loadedResponses }
        : prev
    )
  }, [decisions, stageDecisions, groupActivityId, stack.elements, isBonusPhase])

  useEffect(() => {
    setRevealedHints(
      Object.fromEntries(
        (stack.elements ?? []).flatMap((element) => {
          const hints =
            element.revealedHints ??
            (element.revealedHint ? [element.revealedHint] : [])
          return hints.length > 0 ? [[element.id, hints]] : []
        })
      )
    )
  }, [stack.elements])

  useEffect(() => {
    if (lockoutRemaining <= 0) return
    const timeout = setTimeout(
      () => setLockoutRemaining((remaining) => Math.max(0, remaining - 1)),
      1000
    )
    return () => clearTimeout(timeout)
  }, [lockoutRemaining])

  const responseEntries = Object.entries(studentResponse)
  const submissionEntries = isStagedEscapeRoom
    ? responseEntries.filter(
        ([instanceId]) => parseInt(instanceId) === currentStageId
      )
    : responseEntries

  const handleEscapeRoomError = async (error: unknown) => {
    const escapeError =
      error instanceof ApolloError
        ? error.graphQLErrors.find((entry) =>
            String(entry.extensions?.code).startsWith('ESCAPE_ROOM_')
          )
        : undefined
    if (escapeError?.extensions?.code === 'ESCAPE_ROOM_LOCKOUT') {
      const remaining = escapeError.extensions.lockoutRemainingSeconds
      const attemptsLeft = escapeError.extensions.attemptsLeft
      if (typeof remaining === 'number') setLockoutRemaining(remaining)
      // Without a lockout window the answer is simply wrong: try again.
      toast({
        type: 'error',
        message:
          typeof remaining === 'number' && remaining <= 0
            ? typeof attemptsLeft === 'number'
              ? t('pwa.practiceQuiz.escapeRoomWrongTriesToast', {
                  count: attemptsLeft,
                })
              : t('pwa.practiceQuiz.escapeRoomIncorrectToast')
            : t('pwa.practiceQuiz.escapeRoomLockoutToast'),
      })
    } else if (escapeError?.extensions?.code === 'ESCAPE_ROOM_REVEALED') {
      // The stage is cleared without a correct answer; the refetch below
      // unlocks the next one.
      toast({
        type: 'error',
        message: t('pwa.practiceQuiz.escapeRoomRevealedToast'),
      })
    } else if (escapeError?.extensions?.code === 'ESCAPE_ROOM_SKIP_DISABLED') {
      toast({
        type: 'error',
        message: t('pwa.practiceQuiz.escapeRoomSkipDisabledToast'),
      })
    } else if (
      escapeError?.extensions?.code === 'ESCAPE_ROOM_GATED' ||
      escapeError?.extensions?.code === 'ESCAPE_ROOM_CONFLICT'
    ) {
      // A teammate cleared this stage first; the refetch below shows it.
    } else if (escapeError?.extensions?.code === 'ESCAPE_ROOM_EXPIRED') {
      toast({
        type: 'error',
        message: t('pwa.practiceQuiz.escapeRoomExpiredToast'),
      })
    } else {
      toast({ type: 'error', message: t('shared.generic.systemError') })
    }
    await onEscapeRoomStateChanged?.()
  }

  const getNextHintPenalty = (revealedCount: number) =>
    escapeRoomRules?.hintPenalties[revealedCount] ?? hintPenalty

  const revealHint = async (instanceId: number) => {
    if (!groupActivityId || !groupId) return
    const penalty = getNextHintPenalty(revealedHints[instanceId]?.length ?? 0)
    try {
      const result = await requestEscapeRoomHint({
        variables: { groupActivityId, groupId, instanceId },
      })
      const hints = result.data?.requestEscapeRoomHint?.hints
      if (hints) {
        setRevealedHints((current) => ({ ...current, [instanceId]: hints }))
        toast({
          type: 'success',
          message: t('pwa.practiceQuiz.escapeRoomHintRevealedToast', {
            penalty,
          }),
        })
      }
      await onEscapeRoomStateChanged?.()
    } catch (error) {
      await handleEscapeRoomError(error)
    }
  }

  const skipStage = async () => {
    if (!groupActivityId || !groupId) return
    try {
      await skipEscapeRoomStage({ variables: { groupActivityId, groupId } })
      toast({
        type: 'success',
        message: t('pwa.practiceQuiz.escapeRoomSkippedToast', {
          penalty: escapeRoomRules?.skipPenalty ?? 0,
        }),
      })
      await onEscapeRoomStateChanged?.()
    } catch (error) {
      await handleEscapeRoomError(error)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-12 md:gap-8">
        {stack.elements &&
          stack.elements.length > 0 &&
          stack.elements.map((element, elementIx) => {
            // the bonus stage is not a required stage until the attempt is
            // completed and its question is offered
            if (
              isStagedEscapeRoom &&
              element.id === escapeRoomRules?.bonusInstanceId &&
              !escapeRoomRules.bonusOpen &&
              !clearedStageIds.has(element.id)
            ) {
              return null
            }
            const stageOutcome = escapeRoomRules?.stageOutcomes.find(
              (entry) => entry.stageKey === String(element.id)
            )
            const grading = results?.grading.find(
              (grading) => grading.instanceId === element.id
            )
            const correctness = grading
              ? grading.score < grading.maxPoints
                ? grading.score > 0
                  ? ResponseCorrectnessType.Partial
                  : ResponseCorrectnessType.Incorrect
                : ResponseCorrectnessType.Correct
              : undefined

            return (
              <div
                key={`${element.id}-student`}
                className="mb-2 text-lg"
                data-cy={
                  isStagedEscapeRoom
                    ? `group-escape-stage-${elementIx}-${
                        element.id === currentStageId
                          ? 'current'
                          : clearedStageIds.has(element.id)
                            ? 'cleared'
                            : 'content'
                      }`
                    : undefined
                }
              >
                <InstanceHeader
                  index={elementIx}
                  instanceId={element.id}
                  elementId={parseInt(element.elementData.id)}
                  name={element.elementData.name}
                  className="mb-0"
                  correctness={correctness}
                  previousElementFeedback={elementFeedbacks[element.id]}
                  stackInstanceIds={
                    stack.elements?.map((element) => element.id) ?? []
                  }
                  showSeparator={element.elementType === ElementType.Flashcard}
                  withParticipant
                />
                <StudentElement
                  element={element}
                  elementIx={elementIx}
                  studentResponse={studentResponse}
                  setStudentResponse={setStudentResponse}
                  hideReadButton
                  disabledInput={
                    (!!decisions && !isBonusPhase) ||
                    activityEnded ||
                    (isStagedEscapeRoom && element.id !== currentStageId)
                  }
                />
                {groupActivityId &&
                  element.options?.hasHint &&
                  ((revealedHints[element.id]?.length ?? 0) > 0 ||
                    element.id === currentStageId) && (
                    <div className="mt-2 flex flex-col gap-2">
                      {(revealedHints[element.id] ?? []).map((hint, hintIx) => (
                        <UserNotification
                          key={hintIx}
                          type="info"
                          message={hint}
                        />
                      ))}
                      {element.id === currentStageId &&
                        (revealedHints[element.id]?.length ?? 0) <
                          (element.options?.hintCount ?? 1) && (
                          <Button
                            basic
                            disabled={lockoutRemaining > 0}
                            loading={hintLoading}
                            onClick={() => revealHint(element.id)}
                            data={{
                              cy: revealedHints[element.id]?.length
                                ? 'escape-room-next-hint'
                                : `group-escape-room-hint-${elementIx}`,
                            }}
                          >
                            <Button.Label>
                              {t(
                                revealedHints[element.id]?.length
                                  ? 'pwa.practiceQuiz.escapeRoomNextHint'
                                  : 'pwa.practiceQuiz.escapeRoomRequestHint',
                                {
                                  penalty: getNextHintPenalty(
                                    revealedHints[element.id]?.length ?? 0
                                  ),
                                }
                              )}
                            </Button.Label>
                          </Button>
                        )}
                    </div>
                  )}
                {isStagedEscapeRoom && stageOutcome?.outcome === 'REVEALED' && (
                  <UserNotification
                    type="warning"
                    className={{ root: 'mt-2' }}
                    message={t('pwa.practiceQuiz.escapeRoomRevealedNotice', {
                      penalty: escapeRoomRules?.revealPenalty ?? 0,
                    })}
                    data={{ cy: 'escape-room-revealed-notice' }}
                  />
                )}
                {isStagedEscapeRoom &&
                  element.id === currentStageId &&
                  element.id !== escapeRoomRules?.bonusInstanceId &&
                  typeof escapeRoomRules?.maxWrongAttempts === 'number' && (
                    <UserNotification
                      type="info"
                      className={{ root: 'mt-2' }}
                      message={t('pwa.practiceQuiz.escapeRoomTriesLeft', {
                        count: Math.max(
                          escapeRoomRules.maxWrongAttempts -
                            (stageOutcome?.wrongAttempts ?? 0),
                          0
                        ),
                      })}
                      data={{ cy: 'escape-room-tries-left' }}
                    />
                  )}
                {isStagedEscapeRoom &&
                  element.id === currentStageId &&
                  element.id !== escapeRoomRules?.bonusInstanceId &&
                  escapeRoomRules?.attemptInProgress &&
                  typeof escapeRoomRules.skipPenalty === 'number' &&
                  !activityEnded && (
                    <div className="mt-2 flex flex-col">
                      <EscapeRoomSkipButton
                        penalty={escapeRoomRules.skipPenalty}
                        loading={skipLoading}
                        onSkip={skipStage}
                      />
                    </div>
                  )}
                {grading && correctness && (
                  <div
                    className={twMerge(
                      'border-l-4! mb-6 mt-3 rounded text-base shadow',
                      correctness === ResponseCorrectnessType.Correct &&
                        'border-l-green-500!',
                      correctness === ResponseCorrectnessType.Partial &&
                        'border-l-yellow-500!',
                      correctness === ResponseCorrectnessType.Incorrect &&
                        'border-l-red-700!'
                    )}
                    data-cy={`group-activity-grading-feedback-${elementIx}`}
                  >
                    <div
                      className={twMerge(
                        'flex flex-row justify-between px-2 py-1',
                        correctness === ResponseCorrectnessType.Correct &&
                          'bg-green-100',
                        correctness === ResponseCorrectnessType.Partial &&
                          'bg-yellow-100',
                        correctness === ResponseCorrectnessType.Incorrect &&
                          'bg-red-200'
                      )}
                    >
                      <div>{t(`pwa.groupActivity.answer${correctness}`)}</div>
                      <div className="self-end font-bold">{`${grading.score}/${
                        grading.maxPoints
                      } ${t('shared.generic.points')}`}</div>
                    </div>
                    {grading.feedback && (
                      <DynamicMarkdown
                        className={{ root: 'pt-0! mt-1 p-2' }}
                        content={grading.feedback}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>
      {(!decisions || isBonusPhase) && !activityEnded ? (
        <Button
          primary
          disabled={
            submissionEntries.length === 0 ||
            (isStagedEscapeRoom && !currentStageId) ||
            submissionEntries.some(([, response]) => !response.valid) ||
            activityEnded ||
            lockoutRemaining > 0
          }
          onClick={async () => {
            try {
              const result = await submitGroupActivityDecisions({
                variables: {
                  activityId: activityId,
                  responses: submissionEntries.map(([instanceId, value]) => {
                    if (
                      value.type === ElementType.Sc ||
                      value.type === ElementType.Mc ||
                      value.type === ElementType.Kprim
                    ) {
                      // convert the solution objects into integer lists
                      const responseList: ChoicesResponse[] = Object.entries(
                        value.response!
                      )
                        .filter(([, value]) => value)
                        .map(([key, value]) => ({
                          ix: parseInt(key),
                          selected: value ?? false,
                        }))

                      return {
                        instanceId: parseInt(instanceId),
                        type: value.type,
                        choicesResponse: responseList,
                      }
                    } else if (value.type === ElementType.Numerical) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Numerical,
                        numericalResponse: parseFloat(value.response!),
                      }
                    } else if (value.type === ElementType.FreeText) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.FreeText,
                        freeTextResponse: value.response,
                      }
                    } else if (value.type === ElementType.QrScan) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.QrScan,
                        qrScanResponse: value.response,
                      }
                    } else if (value.type === ElementType.Content) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Content,
                        contentReponse: value.response,
                      }
                    } else if (value.type === ElementType.Selection) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Selection,
                        selectionResponse: Object.values(
                          value.response!
                        ).filter(
                          (entry) =>
                            entry !== -1 &&
                            typeof entry !== 'undefined' &&
                            entry !== null
                        ),
                      }
                    } else if (value.type === ElementType.CaseStudy) {
                      const caseStudyResponse: CaseStudyCaseResponse[] =
                        Object.entries(value.response!).map(
                          ([caseId, caseResponse]) => {
                            return {
                              caseId,
                              itemResponses: Object.entries(caseResponse).map(
                                ([itemId, itemResponse]) => {
                                  return {
                                    itemId: parseInt(itemId),
                                    criterionResponses: Object.entries(
                                      itemResponse
                                    ).flatMap(
                                      ([criterionId, criterionResponse]) => {
                                        if (
                                          typeof criterionResponse ===
                                          'undefined'
                                        ) {
                                          return []
                                        }

                                        return {
                                          criterionId: criterionId,
                                          response: criterionResponse,
                                        }
                                      }
                                    ),
                                  }
                                }
                              ),
                            }
                          }
                        )

                      return {
                        instanceId: parseInt(instanceId),
                        type: value.type,
                        caseStudyResponse,
                      }
                    } else {
                      return {
                        instanceId: parseInt(instanceId),
                        type: value.type,
                        response: value.response,
                      }
                    }
                  }),
                },
              })

              if (!result?.data?.submitGroupActivityDecisions) {
                toast({
                  type: 'error',
                  message: t('shared.generic.systemError'),
                })
                return
              }

              if (!groupActivityId) setStudentResponse({})
              await onEscapeRoomStateChanged?.()
            } catch (error) {
              await handleEscapeRoomError(error)
            }
          }}
          type="submit"
          loading={submitLoading}
          className={{
            root: 'float-right mt-4 text-lg font-bold',
          }}
          data={{ cy: 'submit-group-activity' }}
        >
          <Button.Label>{t('pwa.groupActivity.sendAnswers')}</Button.Label>
        </Button>
      ) : null}
      {!!decisions && submittedAt ? (
        <div className="mt-4 rounded bg-slate-100 p-2 text-center text-sm text-slate-500">
          {t.rich('pwa.groupActivity.alreadySubmittedAt', {
            br: () => <br />,
            date: submittedAt,
          })}
        </div>
      ) : null}
    </>
  )
}

export default GroupActivityStack
