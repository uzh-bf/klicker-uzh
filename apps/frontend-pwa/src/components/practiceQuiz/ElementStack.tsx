import { ApolloError, useMutation, useQuery } from '@apollo/client'
import {
  type CaseStudyCaseResponse,
  type ElementStack as ElementStackType,
  ElementType,
  FlashcardCorrectness,
  FlashcardCorrectnessType,
  GetPreviousStackEvaluationDocument,
  RequestEscapeRoomHintDocument,
  RespondToElementStackDocument,
  SkipEscapeRoomStageDocument,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import StudentElement, {
  type CaseStudyStudentResponseType,
  type StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import type { ChoicesResponse } from '@klicker-uzh/types'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H2, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import useComponentVisibleCounter from '../hooks/useComponentVisibleCounter'
import useStackElementFeedbacks from '../hooks/useStackElementFeedbacks'
import Bookmark from './Bookmark'
import type { EmbedQuizNavigationState } from './embed'
import EscapeRoomSkipButton from './EscapeRoomSkipButton'
import InstanceHeader from './InstanceHeader'

// Choices render their explanation inline. Other element types render their
// solutions in the evaluation panel, so focused feedback must show that panel.
const CHOICES_ELEMENT_TYPES = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
]

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
  focusedPresentation?: boolean
  hostNavigation?: boolean
  hostAdvanceRequest?: number
  onHostNavigationStateChange?: (state: EmbedQuizNavigationState) => void
  // Escape-room hints: set only when this stack belongs to an escape-room
  // activity. Drives the per-element "reveal hint" button (shown only for
  // elements whose options.hasHint is true). Revealing charges hintPenalty
  // seconds server-side; onStateChanged refetches so timer/lockout state stays
  // synchronized after hints and submissions.
  // Scoring rules (see getEscapeRoomStageRules) drive the next-hint price, the
  // tries-left counter, the revealed notice and the skip button; penalties only
  // count toward the ranked time, never the countdown.
  escapeRoom?: {
    activityType: 'practiceQuiz' | 'microLearning'
    hintPenalty: number
    hintPenalties?: number[]
    maxWrongAttempts?: number | null
    revealPenalty?: number
    // null when skipping is not offered for this stage
    skipPenalty?: number | null
    stageOutcome?: { wrongAttempts: number; outcome?: string | null }
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
  focusedPresentation = false,
  hostNavigation = false,
  hostAdvanceRequest = 0,
  onHostNavigationStateChange,
  escapeRoom,
}: ElementStackProps) {
  const t = useTranslations()
  const timeRef = useRef(0)
  useComponentVisibleCounter({ timeRef })

  const embeddedButtonClass = embedded ? 'shadow-lg' : 'float-right mt-4'
  const hostAdvanceActionRef = useRef<(() => void) | null>(null)
  const lastHandledHostAdvanceRequest = useRef(hostAdvanceRequest)
  const wrapEmbedded = (node: ReactNode) =>
    embedded && !hostNavigation ? (
      <div className="sticky bottom-4 z-50 flex justify-end">{node}</div>
    ) : embedded ? null : (
      node
    )

  const [respondToElementStack, { loading: submittingResponse }] = useMutation(
    RespondToElementStackDocument
  )

  // Escape-room hints: revealed text is kept per instanceId so it stays visible
  // once unlocked. The server charge is idempotent, but we also track a
  // per-instance "requesting" flag to disable the button while in flight.
  const [requestEscapeRoomHint] = useMutation(RequestEscapeRoomHintDocument)
  const [revealedHints, setRevealedHints] = useState<Record<number, string[]>>(
    {}
  )
  const [requestingHintFor, setRequestingHintFor] = useState<number | null>(
    null
  )
  const [skipEscapeRoomStage, { loading: skipping }] = useMutation(
    SkipEscapeRoomStageDocument
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
      case 'ESCAPE_ROOM_SKIP_DISABLED':
        toast({
          message: t('pwa.practiceQuiz.escapeRoomSkipDisabledToast'),
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

  // Hints revealed so far for an instance: the latest of the locally tracked
  // list and the list restored from the server after a reload.
  const getRevealedHints = (
    element: NonNullable<ElementStackType['elements']>[number]
  ) => {
    const restored =
      element.revealedHints ??
      (element.revealedHint ? [element.revealedHint] : [])
    const local = revealedHints[element.id] ?? []
    return local.length > restored.length ? local : restored
  }

  const getNextHintPenalty = (revealedCount: number) =>
    escapeRoom?.hintPenalties?.[revealedCount] ?? escapeRoom?.hintPenalty ?? 0

  const handleRequestHint = async (instanceId: number) => {
    const element = stack.elements?.find((entry) => entry.id === instanceId)
    if (!escapeRoom || !element) return
    const penalty = getNextHintPenalty(getRevealedHints(element).length)
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
      const hints = result.data?.requestEscapeRoomHint?.hints
      if (hints) {
        setRevealedHints((prev) => ({ ...prev, [instanceId]: hints }))
        toast({
          message: t('pwa.practiceQuiz.escapeRoomHintRevealedToast', {
            penalty,
          }),
          type: 'success',
        })
        // Refetch so the attempt's penalty and hint state stay in sync.
        await escapeRoom.onStateChanged()
      }
    } catch (error) {
      handleEscapeRoomError(error)
    } finally {
      setRequestingHintFor(null)
    }
  }

  // Skipping clears the current stage at a ranked-time penalty; the stage is
  // final, so move on like after a correct answer.
  const handleSkip = async () => {
    if (!escapeRoom) return
    try {
      await skipEscapeRoomStage({
        variables:
          escapeRoom.activityType === 'microLearning'
            ? { microLearningId: parentId }
            : { practiceQuizId: parentId },
      })
      toast({
        message: t('pwa.practiceQuiz.escapeRoomSkippedToast', {
          penalty: escapeRoom.skipPenalty ?? 0,
        }),
        type: 'success',
      })
      await escapeRoom.onStateChanged()
      handleNextElement(StackFeedbackStatus.Correct)
    } catch (error) {
      handleEscapeRoomError(error)
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
  }, [stackStorage, studentResponse])

  const responseEntries = Object.values(studentResponse)
  const responsesInitialized = responseEntries.length > 0
  const responsesInvalid = responseEntries.some((response) => !response.valid)
  const responsesValid = responsesInitialized && !responsesInvalid
  const responseSubmissionDisabled =
    (!previewOnly && activityExpired) ||
    lockoutRemaining > 0 ||
    responsesInvalid
  const hostNavigationState = useMemo<EmbedQuizNavigationState>(
    () =>
      typeof stackStorage !== 'undefined' && !showMarkAsRead
        ? { phase: 'feedback', canAdvance: true }
        : {
            phase: 'answering',
            canAdvance: showMarkAsRead
              ? responsesValid
              : responsesInitialized &&
                !submittingResponse &&
                !responseSubmissionDisabled,
          },
    [
      responseSubmissionDisabled,
      responsesInitialized,
      responsesValid,
      showMarkAsRead,
      stackStorage,
      submittingResponse,
    ]
  )

  useEffect(() => {
    if (!hostNavigation) return
    onHostNavigationStateChange?.(hostNavigationState)
  }, [hostNavigation, hostNavigationState, onHostNavigationStateChange])

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

  const handleContinue = useCallback(() => {
    setStudentResponse({})

    if (currentStep === totalSteps) {
      onAllStacksCompletion(lastGradedStatus)
    } else {
      handleNextElement(lastGradedStatus)
    }
  }, [
    currentStep,
    handleNextElement,
    lastGradedStatus,
    onAllStacksCompletion,
    totalSteps,
  ])

  const handleMarkAsRead = useCallback(() => {
    // update the read status of all content elements in studentResponse to true
    setStudentResponse((currentResponses) =>
      Object.fromEntries(
        Object.entries(currentResponses).map(([instanceId, value]) => [
          instanceId,
          value.type === ElementType.Content
            ? { ...value, response: true }
            : value,
        ])
      )
    )
  }, [])

  const handleSubmit = useCallback(async () => {
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
              } else if (value.response === FlashcardCorrectness.Partial) {
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
                    typeof entry === 'undefined' || entry === null ? -1 : entry
                ),
              }
            } else if (value.type === ElementType.CaseStudy) {
              const caseStudyResponse: CaseStudyCaseResponse[] = Object.entries(
                value.response!
              ).map(([caseId, caseResponse]) => {
                return {
                  caseId,
                  itemResponses: Object.entries(caseResponse).map(
                    ([itemId, itemResponse]) => {
                      return {
                        itemId: parseInt(itemId),
                        criterionResponses: Object.entries(
                          itemResponse
                        ).flatMap(([criterionId, criterionResponse]) => {
                          if (typeof criterionResponse === 'undefined') {
                            return []
                          }

                          return {
                            criterionId: criterionId,
                            response: criterionResponse,
                          }
                        }),
                      }
                    }
                  ),
                }
              })

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
      Object.entries(studentResponse).reduce<StackStudentResponseType>(
        (acc, [key, value]) => {
          return {
            ...acc,
            [key]: {
              ...value,
              evaluation: result.data!.respondToElementStack!.evaluations?.find(
                (evaluation) => evaluation.instanceId === parseInt(key)
              ),
            },
          }
        },
        {}
      )
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
  }, [
    courseId,
    currentStep,
    escapeRoom,
    handleEscapeRoomError,
    handleNextElement,
    onAllStacksCompletion,
    respondToElementStack,
    setStackStorage,
    setStepStatus,
    stack.id,
    studentResponse,
    totalSteps,
  ])

  useEffect(() => {
    hostAdvanceActionRef.current =
      typeof stackStorage !== 'undefined' && !showMarkAsRead
        ? handleContinue
        : showMarkAsRead
          ? handleMarkAsRead
          : handleSubmit

    return () => {
      hostAdvanceActionRef.current = null
    }
  }, [
    handleContinue,
    handleMarkAsRead,
    handleSubmit,
    showMarkAsRead,
    stackStorage,
  ])

  useEffect(() => {
    if (!hostNavigation) {
      lastHandledHostAdvanceRequest.current = hostAdvanceRequest
      return
    }

    if (lastHandledHostAdvanceRequest.current === hostAdvanceRequest) return
    lastHandledHostAdvanceRequest.current = hostAdvanceRequest

    if (!hostNavigationState.canAdvance) return

    hostAdvanceActionRef.current?.()
  }, [hostAdvanceRequest, hostNavigation, hostNavigationState.canAdvance])

  return (
    <div className={focusedPresentation ? 'pb-0' : 'pb-12'}>
      <div className="w-full">
        {activityExpired && activityExpiredMessage && (
          <UserNotification
            type="error"
            message={activityExpiredMessage}
            className={{ root: 'mb-2' }}
          />
        )}

        {!focusedPresentation && (
          <>
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
          </>
        )}

        <div
          className={
            focusedPresentation
              ? 'flex flex-col gap-6'
              : 'flex flex-col gap-8 md:gap-12'
          }
        >
          {stack.elements &&
            stack.elements.length > 0 &&
            stack.elements.map((element, elementIx) => {
              const elementHints = getRevealedHints(element)
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
                    preview={
                      embedded &&
                      (focusedPresentation
                        ? hostNavigationState.phase !== 'feedback' ||
                          CHOICES_ELEMENT_TYPES.includes(element.elementType)
                        : !openEvaluations.has(element.id))
                    }
                  />
                  {withParticipant &&
                    escapeRoom &&
                    element.options?.hasHint && (
                      <div className="mt-2 flex flex-col gap-2">
                        {elementHints.map((hint, hintIx) => (
                          <UserNotification
                            key={hintIx}
                            type="success"
                            message={hint}
                            data={{
                              cy:
                                hintIx === 0
                                  ? `escape-room-hint-text-${element.id}`
                                  : `escape-room-hint-text-${element.id}-${hintIx}`,
                            }}
                          />
                        ))}
                        {elementHints.length <
                          (element.options?.hintCount ?? 1) && (
                          <Button
                            loading={requestingHintFor === element.id}
                            disabled={requestingHintFor !== null}
                            onClick={() => handleRequestHint(element.id)}
                            data={{
                              cy:
                                elementHints.length === 0
                                  ? `request-escape-room-hint-${element.id}`
                                  : 'escape-room-next-hint',
                            }}
                          >
                            <Button.Label>
                              {t(
                                elementHints.length === 0
                                  ? 'pwa.practiceQuiz.escapeRoomRequestHint'
                                  : 'pwa.practiceQuiz.escapeRoomNextHint',
                                {
                                  penalty: getNextHintPenalty(
                                    elementHints.length
                                  ),
                                }
                              )}
                            </Button.Label>
                          </Button>
                        )}
                      </div>
                    )}
                </div>
              )
            })}
        </div>
      </div>

      {escapeRoom &&
        !previewOnly &&
        escapeRoom.stageOutcome?.outcome === 'REVEALED' && (
          <UserNotification
            type="warning"
            className={{ root: 'mt-4' }}
            message={t('pwa.practiceQuiz.escapeRoomRevealedNotice', {
              penalty: escapeRoom.revealPenalty ?? 0,
            })}
            data={{ cy: 'escape-room-revealed-notice' }}
          />
        )}

      {escapeRoom &&
        !previewOnly &&
        typeof escapeRoom.maxWrongAttempts === 'number' &&
        !escapeRoom.stageOutcome?.outcome && (
          <UserNotification
            type="info"
            className={{ root: 'mt-4' }}
            message={t('pwa.practiceQuiz.escapeRoomTriesLeft', {
              count: Math.max(
                escapeRoom.maxWrongAttempts -
                  (escapeRoom.stageOutcome?.wrongAttempts ?? 0),
                0
              ),
            })}
            data={{ cy: 'escape-room-tries-left' }}
          />
        )}

      {/* an open escape room stage returns no evaluation, only the status */}
      {escapeRoom &&
        !previewOnly &&
        typeof stackStorage !== 'undefined' &&
        lastGradedStatus === StackFeedbackStatus.Incorrect &&
        !Object.values(stackStorage).some((entry) => entry.evaluation) && (
          <UserNotification
            type="error"
            className={{ root: 'mt-4' }}
            message={t('pwa.practiceQuiz.escapeRoomIncorrectToast')}
            data={{ cy: 'escape-room-incorrect-notice' }}
          />
        )}

      {/* display continue button if question was already answered */}
      {typeof stackStorage !== 'undefined' && !showMarkAsRead
        ? wrapEmbedded(
            <Button
              onClick={handleContinue}
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
      {showMarkAsRead &&
        wrapEmbedded(
          <Button
            className={{
              root: embeddedButtonClass,
            }}
            disabled={responsesInvalid}
            onClick={handleMarkAsRead}
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

      {escapeRoom &&
        !previewOnly &&
        typeof escapeRoom.skipPenalty === 'number' &&
        !escapeRoom.stageOutcome?.outcome &&
        typeof stackStorage === 'undefined' && (
          <div className="mt-4 flex flex-col">
            <EscapeRoomSkipButton
              penalty={escapeRoom.skipPenalty}
              loading={skipping}
              onSkip={handleSkip}
            />
          </div>
        )}

      {typeof stackStorage === 'undefined' &&
        !showMarkAsRead &&
        wrapEmbedded(
          <Button
            primary
            loading={submittingResponse}
            disabled={!responsesInitialized || responseSubmissionDisabled}
            className={{
              root: embeddedButtonClass,
            }}
            onClick={handleSubmit}
            data={{ cy: 'student-stack-submit' }}
          >
            <Button.Label>{t('shared.generic.submit')}</Button.Label>
          </Button>
        )}
    </div>
  )
}

export default ElementStack
