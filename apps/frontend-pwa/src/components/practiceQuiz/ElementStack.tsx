import { ApolloError, useMutation, useQuery } from '@apollo/client'
import {
  CaseStudyCaseResponse,
  ElementStack as ElementStackType,
  ElementType,
  FlashcardCorrectness,
  FlashcardCorrectnessType,
  GetPreviousStackEvaluationDocument,
  RequestEscapeRoomHintDocument,
  RespondToElementStackDocument,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  CaseStudyStudentResponseType,
  StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import { ChoicesResponse } from '@klicker-uzh/types'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H2, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import useComponentVisibleCounter from '../hooks/useComponentVisibleCounter'
import useStackElementFeedbacks from '../hooks/useStackElementFeedbacks'
import Bookmark from './Bookmark'
import InstanceHeader from './InstanceHeader'

interface ElementStackProps {
  parentId: string
  courseId: string
  embedded?: boolean
  stack: ElementStackType
  currentStep: number
  totalSteps: number
  setStepStatus?: ({
    status,
    score,
  }: {
    status: StackFeedbackStatus
    score?: number | null
  }) => void
  // the freshly graded status is passed on the immediate (flashcard/content)
  // continue path, where the parent's progress state is not yet settled
  handleNextElement: (gradedStatus?: StackFeedbackStatus) => void
  onAllStacksCompletion: (gradedStatus?: StackFeedbackStatus) => void
  withParticipant?: boolean
  bookmarks?: number[] | null
  hideBookmark?: boolean
  singleSubmission?: boolean
  activityExpired?: boolean
  activityExpiredMessage?: string
  previewOnly?: boolean
  // Escape-room hints: set only when this stack belongs to an escape-room
  // activity. Drives the per-element "reveal hint" button (shown only for
  // elements whose options.hasHint is true). Revealing charges hintPenalty
  // seconds server-side; onStateChanged refetches so timer/lockout state stays
  // synchronized after hints and submissions.
  escapeRoom?: {
    activityType: 'practiceQuiz' | 'microLearning'
    hintPenalty: number
    onStateChanged: () => void | Promise<unknown>
  }
}

function ElementStack({
  parentId,
  courseId,
  embedded = false,
  stack,
  currentStep,
  totalSteps,
  setStepStatus,
  handleNextElement,
  onAllStacksCompletion,
  withParticipant = false,
  bookmarks,
  hideBookmark = false,
  singleSubmission = false,
  activityExpired = false,
  activityExpiredMessage,
  previewOnly = false,
  escapeRoom,
}: ElementStackProps) {
  const t = useTranslations()
  const timeRef = useRef(0)
  useComponentVisibleCounter({ timeRef })

  const embeddedButtonClass = embedded ? 'shadow-lg' : 'float-right mt-4'
  const wrapEmbedded = (node: ReactNode) =>
    embedded ? (
      <div className="sticky bottom-4 z-50 flex justify-end">{node}</div>
    ) : (
      node
    )

  const [respondToElementStack, { loading: submittingResponse }] = useMutation(
    RespondToElementStackDocument
  )

  // Escape-room hints: revealed text is kept per instanceId so it stays visible
  // once unlocked. The server charge is idempotent, but we also track a
  // per-instance "requesting" flag to disable the button while in flight.
  const [requestEscapeRoomHint] = useMutation(RequestEscapeRoomHintDocument)
  const [revealedHints, setRevealedHints] = useState<Record<number, string>>({})
  const [requestingHintFor, setRequestingHintFor] = useState<number | null>(
    null
  )
  const elementFeedbacks = useStackElementFeedbacks({
    instanceIds: stack.elements?.map((element) => element.id) ?? [],
    withParticipant: withParticipant,
  })

  const [stackStorage, setStackStorage] =
    useLocalStorage<StackStudentResponseType>(
      `qi-${parentId}-${stack.id}`,
      undefined
    )

  const [studentResponse, setStudentResponse] =
    useState<StackStudentResponseType>({})

  const [openEvaluations, setOpenEvaluations] = useState<Set<number>>(new Set())
  const [lastGradedStatus, setLastGradedStatus] =
    useState<StackFeedbackStatus>()

  // Escape-room lockout: a wrong answer sets a server-side lockout window, and
  // the next submit throws ESCAPE_ROOM_LOCKOUT carrying lockoutUntil. Track it
  // to disable the submit button and show a live retry countdown.
  const [lockoutDeadline, setLockoutDeadline] = useState<number | null>(null)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)

  useEffect(() => {
    if (lockoutDeadline === null) {
      setLockoutRemaining(0)
      return
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((lockoutDeadline - performance.now()) / 1000)
      )
      setLockoutRemaining(remaining)
      if (remaining <= 0) setLockoutDeadline(null)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lockoutDeadline])

  // Map the structured escape-room error codes thrown by respondToElementStack
  // to localized participant feedback. Non-escape errors surface a generic
  // system-error toast (previously the rejected promise failed silently).
  const handleEscapeRoomError = (error: unknown) => {
    const gqlErrors = error instanceof ApolloError ? error.graphQLErrors : []
    const escapeError = gqlErrors.find((err) => {
      const code = err.extensions?.code
      return typeof code === 'string' && code.startsWith('ESCAPE_ROOM_')
    })
    if (!escapeError) {
      toast({
        message: t('shared.generic.systemError'),
        type: 'error',
      })
      return
    }
    switch (escapeError.extensions?.code) {
      case 'ESCAPE_ROOM_LOCKOUT': {
        const remaining = escapeError.extensions?.lockoutRemainingSeconds
        if (typeof remaining === 'number') {
          setLockoutDeadline(performance.now() + remaining * 1000)
        }
        toast({
          message: t('pwa.practiceQuiz.escapeRoomLockoutToast'),
          type: 'error',
        })
        break
      }
      case 'ESCAPE_ROOM_EXPIRED':
        toast({
          message: t('pwa.practiceQuiz.escapeRoomExpiredToast'),
          type: 'error',
        })
        break
      case 'ESCAPE_ROOM_GATED':
        toast({
          message: t('pwa.practiceQuiz.escapeRoomGatedToast'),
          type: 'error',
        })
        break
      default:
        toast({
          message: t('pwa.practiceQuiz.escapeRoomForbiddenToast'),
          type: 'error',
        })
    }
  }

  const handleRequestHint = async (instanceId: number) => {
    const restoredHint = stack.elements?.find(
      (element) => element.id === instanceId
    )?.revealedHint
    if (!escapeRoom || revealedHints[instanceId] || restoredHint) return
    setRequestingHintFor(instanceId)
    try {
      const result = await requestEscapeRoomHint({
        variables: {
          instanceId,
          ...(escapeRoom.activityType === 'microLearning'
            ? { microLearningId: parentId }
            : { practiceQuizId: parentId }),
        },
      })
      const hint = result.data?.requestEscapeRoomHint?.hint
      if (hint) {
        setRevealedHints((prev) => ({ ...prev, [instanceId]: hint }))
        toast({
          message: t('pwa.practiceQuiz.escapeRoomHintRevealedToast', {
            penalty: escapeRoom.hintPenalty,
          }),
          type: 'success',
        })
        // Refetch so the live countdown picks up the newly charged penalty.
        await escapeRoom.onStateChanged()
      }
    } catch (error) {
      handleEscapeRoomError(error)
    } finally {
      setRequestingHintFor(null)
    }
  }

  const showMarkAsRead = useMemo(() => {
    if (
      Object.entries(studentResponse).some(
        ([key, response]) =>
          response.type === ElementType.Content &&
          typeof response.response === 'undefined' &&
          !stackStorage?.[parseInt(key)]?.response
      )
    ) {
      return true
    } else {
      return false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentResponse])

  // initialize student responses
  useStudentResponse({
    stack,
    currentStep,
    setStudentResponse,
  })

  // if single submission is enabled, fetch the previous answer & evaluation and do not submit again
  const { data: evaluationData } = useQuery(
    GetPreviousStackEvaluationDocument,
    {
      skip: previewOnly || !singleSubmission || !!stackStorage,
      variables: {
        stackId: stack.id,
      },
    }
  )

  // if single submission is enabled, fetch the previous answer & evaluation from the database (if available)
  useEffect(() => {
    if (
      !previewOnly &&
      singleSubmission &&
      !stackStorage &&
      evaluationData?.getPreviousStackEvaluation &&
      evaluationData.getPreviousStackEvaluation.evaluations &&
      evaluationData.getPreviousStackEvaluation.evaluations.length > 0
    ) {
      const evaluations = evaluationData.getPreviousStackEvaluation.evaluations

      setStackStorage(
        evaluations.reduce<StackStudentResponseType>((acc, evaluation) => {
          const foundElement = stack.elements?.find(
            (element) => element.id === evaluation.instanceId
          )
          const commonAttributes = {
            valid: true,
            evaluation,
          }

          if (!foundElement || !evaluation.lastResponse) {
            // Handle the error, log a warning, or skip this evaluation
            console.warn(`Element with ID ${evaluation.instanceId} not found.`)
            return acc
          } else {
            const elementType = foundElement.elementType
            if (
              elementType === ElementType.Flashcard &&
              evaluation.__typename === 'FlashcardInstanceEvaluation'
            ) {
              acc[evaluation.instanceId] = {
                ...commonAttributes,
                type: elementType,
                response: evaluation.lastResponse.correctness,
              }

              return acc
            } else if (
              elementType === ElementType.Content &&
              evaluation.__typename === 'ContentInstanceEvaluation'
            ) {
              acc[evaluation.instanceId] = {
                ...commonAttributes,
                type: elementType,
                response: evaluation.lastResponse.viewed,
              }

              return acc
            } else if (
              (elementType === ElementType.Sc ||
                elementType === ElementType.Mc) &&
              evaluation.__typename === 'ChoicesInstanceEvaluation'
            ) {
              const storedChoices = evaluation.lastResponse.choices
              acc[evaluation.instanceId] = {
                ...commonAttributes,
                type: elementType,
                response: storedChoices.reduce<Record<number, boolean>>(
                  (choiceAcc, choice) => {
                    choiceAcc[choice.ix] = true
                    return choiceAcc
                  },
                  {}
                ),
              }

              return acc
            } else if (
              elementType === ElementType.Kprim &&
              evaluation.__typename === 'ChoicesInstanceEvaluation'
            ) {
              const storedChoicesIxs = evaluation.lastResponse.choices
                .filter((choice) => choice.selected)
                .map((choice) => choice.ix)
              acc[evaluation.instanceId] = {
                ...commonAttributes,
                type: elementType,
                response: {
                  0: storedChoicesIxs.includes(0),
                  1: storedChoicesIxs.includes(1),
                  2: storedChoicesIxs.includes(2),
                  3: storedChoicesIxs.includes(3),
                },
              }

              return acc
            } else if (
              (elementType === ElementType.Numerical ||
                elementType === ElementType.FreeText) &&
              (evaluation.__typename === 'FreeTextInstanceEvaluation' ||
                evaluation.__typename === 'NumericalInstanceEvaluation')
            ) {
              acc[evaluation.instanceId] = {
                ...commonAttributes,
                type: elementType,
                response: evaluation.lastResponse.value,
              }

              return acc
            } else if (
              elementType === ElementType.Selection &&
              evaluation.__typename === 'SelectionInstanceEvaluation'
            ) {
              acc[evaluation.instanceId] = {
                ...commonAttributes,
                type: elementType,
                response: evaluation.lastResponse.selection,
              }

              return acc
            } else if (
              elementType === ElementType.CaseStudy &&
              evaluation.__typename === 'CaseStudyInstanceEvaluation'
            ) {
              const lastResponseObject =
                evaluation.lastResponse.assessment.reduce<CaseStudyStudentResponseType>(
                  (caseAcc, caseObj) => {
                    caseAcc[caseObj.caseId] = caseObj.itemResponses.reduce<
                      CaseStudyStudentResponseType['']
                    >((itemAcc, item) => {
                      itemAcc[item.itemId] = item.criterionResponses.reduce<
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

              acc[evaluation.instanceId] = {
                ...commonAttributes,
                type: elementType,
                response: lastResponseObject,
              }

              return acc
            }

            return acc
          }
        }, {})
      )

      // set status and score according to returned correctness
      setStudentResponse({})

      // ? if used for practice quizzes, optionally set the step status here
      // const score = evaluationData?.getPreviousStackEvaluation.score
      // const status = evaluationData?.getPreviousStackEvaluation.status
      // if (typeof setStepStatus !== 'undefined') {
      //   setStepStatus({
      //     status,
      //     score,
      //   })
      // }
    }
  }, [
    evaluationData,
    setStackStorage,
    singleSubmission,
    stack,
    stackStorage,
    previewOnly,
  ])

  return (
    <div className="pb-12">
      <div className="w-full">
        {activityExpired && activityExpiredMessage && (
          <UserNotification
            type="error"
            message={activityExpiredMessage}
            className={{ root: 'mb-2' }}
          />
        )}

        {!previewOnly && !hideBookmark && !embedded ? (
          <div className="flex flex-row items-center justify-between">
            <div>{stack.displayName && <H2>{stack.displayName}</H2>}</div>
            <Bookmark
              bookmarks={bookmarks}
              quizId={parentId === 'bookmarks' ? undefined : parentId}
              stackId={stack.id}
            />
          </div>
        ) : (
          <div>{stack.displayName && <H2>{stack.displayName}</H2>}</div>
        )}

        {stack.description && (
          <div className="mb-4">
            <DynamicMarkdown
              content={stack.description}
              data={{ cy: 'element-stack-description' }}
              withProse
            />
          </div>
        )}

        <div className="flex flex-col gap-8 md:gap-12">
          {stack.elements &&
            stack.elements.length > 0 &&
            stack.elements.map((element, elementIx) => {
              const revealedHint =
                revealedHints[element.id] ?? element.revealedHint
              return (
                <div key={`${element.id}-student`}>
                  <InstanceHeader
                    index={elementIx}
                    instanceId={element.id}
                    elementId={parseInt(element.elementData.id)}
                    name={element.elementData.name}
                    withParticipant={withParticipant}
                    previousElementFeedback={
                      withParticipant ? elementFeedbacks[element.id] : undefined
                    }
                    stackInstanceIds={
                      stack.elements?.map((element) => element.id) ?? []
                    }
                    showSeparator={
                      element.elementType === ElementType.Flashcard
                    }
                    evaluationOpen={openEvaluations.has(element.id)}
                    onToggleEvaluation={
                      embedded && stackStorage?.[element.id]?.evaluation
                        ? () =>
                            setOpenEvaluations((prev) => {
                              const next = new Set(prev)
                              if (next.has(element.id)) {
                                next.delete(element.id)
                              } else {
                                next.add(element.id)
                              }
                              return next
                            })
                        : undefined
                    }
                  />
                  <StudentElement
                    element={element}
                    elementIx={elementIx}
                    studentResponse={studentResponse}
                    setStudentResponse={setStudentResponse}
                    stackStorage={stackStorage}
                    preview={embedded && !openEvaluations.has(element.id)}
                  />
                  {withParticipant &&
                    escapeRoom &&
                    element.options?.hasHint &&
                    (revealedHint ? (
                      <UserNotification
                        type="success"
                        className={{ root: 'mt-2' }}
                        message={revealedHint}
                        data={{ cy: `escape-room-hint-text-${element.id}` }}
                      />
                    ) : (
                      <Button
                        className={{ root: 'mt-2' }}
                        loading={requestingHintFor === element.id}
                        disabled={requestingHintFor !== null}
                        onClick={() => handleRequestHint(element.id)}
                        data={{ cy: `request-escape-room-hint-${element.id}` }}
                      >
                        <Button.Label>
                          {t('pwa.practiceQuiz.escapeRoomRequestHint', {
                            penalty: escapeRoom.hintPenalty,
                          })}
                        </Button.Label>
                      </Button>
                    ))}
                </div>
              )
            })}
        </div>
      </div>

      {/* display continue button if question was already answered */}
      {typeof stackStorage !== 'undefined' && !showMarkAsRead
        ? wrapEmbedded(
            <Button
              onClick={() => {
                setStudentResponse({})

                if (currentStep === totalSteps) {
                  onAllStacksCompletion(lastGradedStatus)
                } else {
                  handleNextElement(lastGradedStatus)
                }
              }}
              className={{
                root: embeddedButtonClass,
              }}
              data={{ cy: 'student-stack-continue' }}
            >
              <Button.Label>
                {currentStep === totalSteps
                  ? t('shared.generic.finish')
                  : t('shared.generic.continue')}
              </Button.Label>
            </Button>
          )
        : null}

      {/* display mark all as read button, if only content elements have not been answered yet */}
      {typeof stackStorage === 'undefined' &&
        showMarkAsRead &&
        wrapEmbedded(
          <Button
            className={{
              root: embeddedButtonClass,
            }}
            disabled={Object.values(studentResponse).some(
              (response) => !response.valid
            )}
            onClick={() => {
              // update the read status of all content elements in studentResponse to true
              setStudentResponse((currentResponses) =>
                Object.entries(
                  currentResponses
                ).reduce<StackStudentResponseType>(
                  (acc, [instanceId, value]) => {
                    if (value.type === ElementType.Content) {
                      return {
                        ...acc,
                        [instanceId]: {
                          ...value,
                          response: true,
                        },
                      }
                    } else {
                      return { ...acc, [instanceId]: value }
                    }
                  },
                  {}
                )
              )
            }}
            data={{ cy: 'practice-quiz-mark-all-as-read' }}
          >
            <Button.Label>{t('pwa.practiceQuiz.markAllAsRead')}</Button.Label>
          </Button>
        )}

      {lockoutRemaining > 0 && (
        <UserNotification
          type="error"
          className={{ root: 'mt-2' }}
          message={t('pwa.practiceQuiz.escapeRoomLockoutCountdown', {
            seconds: lockoutRemaining,
          })}
          data={{ cy: 'escape-room-lockout-countdown' }}
        />
      )}

      {typeof stackStorage === 'undefined' &&
        !showMarkAsRead &&
        wrapEmbedded(
          <Button
            primary
            loading={submittingResponse}
            disabled={
              (!previewOnly && activityExpired) ||
              lockoutRemaining > 0 ||
              Object.values(studentResponse).some((response) => !response.valid)
            }
            className={{
              root: embeddedButtonClass,
            }}
            onClick={async () => {
              const result = await respondToElementStack({
                variables: {
                  stackId: stack.id,
                  courseId: courseId,
                  stackAnswerTime: timeRef.current,
                  responses: Object.entries(studentResponse).map(
                    ([instanceId, value]) => {
                      if (value.type === ElementType.Flashcard) {
                        let responseValue: FlashcardCorrectnessType
                        if (value.response === FlashcardCorrectness.Correct) {
                          responseValue = FlashcardCorrectnessType.Correct
                        } else if (
                          value.response === FlashcardCorrectness.Partial
                        ) {
                          responseValue = FlashcardCorrectnessType.Partial
                        } else {
                          responseValue = FlashcardCorrectnessType.Incorrect
                        }

                        return {
                          instanceId: parseInt(instanceId),
                          type: ElementType.Flashcard,
                          flashcardResponse: responseValue,
                        }
                      } else if (value.type === ElementType.Content) {
                        return {
                          instanceId: parseInt(instanceId),
                          type: ElementType.Content,
                          contentReponse: value.response,
                        }
                      } else if (
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
                      }
                      // submission logic for numerical questions
                      else if (value.type === ElementType.Numerical) {
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
                      } else if (value.type === ElementType.Selection) {
                        return {
                          instanceId: parseInt(instanceId),
                          type: ElementType.Selection,
                          selectionResponse: Object.values(value.response!).map(
                            (entry) =>
                              typeof entry === 'undefined' || entry === null
                                ? -1
                                : entry
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
                    }
                  ),
                },
              }).catch(async (error) => {
                handleEscapeRoomError(error)
                await escapeRoom?.onStateChanged()
                return undefined
              })

              if (!result?.data || !result.data?.respondToElementStack) {
                console.error('Error submitting response')
                return
              }

              setStackStorage(
                Object.entries(
                  studentResponse
                ).reduce<StackStudentResponseType>((acc, [key, value]) => {
                  return {
                    ...acc,
                    [key]: {
                      ...value,
                      evaluation:
                        result.data!.respondToElementStack!.evaluations?.find(
                          (evaluation) =>
                            evaluation.instanceId === parseInt(key)
                        ),
                    },
                  }
                }, {})
              )

              // set status and score according to returned correctness
              const grading = result.data?.respondToElementStack
              await escapeRoom?.onStateChanged()
              setLastGradedStatus(grading.status)
              setStudentResponse({})

              if (typeof setStepStatus !== 'undefined') {
                setStepStatus({
                  status: grading.status,
                  score: grading.score,
                })
              }

              // continue if stack only included content elements and/or flashcards, otherwise show evaluation
              if (
                Object.values(studentResponse).every(
                  (response) =>
                    response.type === ElementType.Content ||
                    response.type === ElementType.Flashcard
                )
              ) {
                if (currentStep === totalSteps) {
                  onAllStacksCompletion(grading.status)
                } else {
                  handleNextElement(grading.status)
                }
              }
            }}
            data={{ cy: 'student-stack-submit' }}
          >
            <Button.Label>{t('shared.generic.submit')}</Button.Label>
          </Button>
        )}
    </div>
  )
}

export default ElementStack
