import useRemainingInstances from '@components/hooks/useRemainingInstances'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementInstance, ElementType } from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import LiveQuizProgress from '@klicker-uzh/shared-components/src/questions/LiveQuizProgress'
import { push } from '@socialgouv/matomo-next'
import { H2, toast, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localforage from 'localforage'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import React, { useEffect, useRef, useState } from 'react'
import { isDeepEqual } from 'remeda'
import {
  type LiveQuizEscapeRoomAttempt,
  useLiveQuizEscapeRoom,
} from '../hooks/useLiveQuizEscapeRoom'
import {
  LiveQuizEscapeRoomOverlay,
  LiveQuizEscapeRoomQuestionControls,
} from './LiveQuizEscapeRoomControls'
import { loadStoredResponse, updateStoredResponses } from './storageHelpers'

const ConfettiExplosion = dynamic(() => import('react-confetti-explosion'), {
  ssr: false,
})

interface QuestionAreaProps {
  isBlockActive?: boolean
  gamificationEnabled: boolean
  expiresAt?: Date
  instances: ElementInstance[]
  handleNewResponse: ({
    liveQuizId,
    instanceId,
    type,
    answer,
    correlationKey,
  }: {
    liveQuizId: string
    instanceId: number
    type: ElementType
    answer: any
    correlationKey?: string | null
  }) => Promise<{
    statusCode: number
    responseTimestamp?: number
    responseStatus?: string
    lockoutUntil?: string
    completed?: boolean
  }>
  quizId: string
  execution: number
  timeLimit?: number
  isStaticPreview?: boolean
  blockId?: number
  escapeRoomConfig?: {
    timeLimit: number
    hintPenalty: number
    introText?: string | null
  } | null
  initialEscapeRoomAttempt?: LiveQuizEscapeRoomAttempt | null
  escapeRoomTotalInstances?: number | null
  escapeRoomClearedInstances?: number | null
  refetchLiveQuiz?: () => Promise<unknown>
}

function QuestionArea({
  isBlockActive = false,
  gamificationEnabled,
  expiresAt,
  instances,
  handleNewResponse,
  quizId,
  timeLimit,
  execution,
  blockId,
  escapeRoomConfig,
  initialEscapeRoomAttempt,
  escapeRoomTotalInstances,
  escapeRoomClearedInstances,
  refetchLiveQuiz,
}: QuestionAreaProps): React.ReactElement {
  const t = useTranslations()

  const [showConfetti, setShowConfetti] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [remainingQuestions, setRemainingQuestions] = useState<number[] | null>(
    null
  )
  const [submittedAt, setSubmittedAt] = useState<number | null>(null)
  const [activeInstance, setActiveInstance] = useState<number>(0)
  const currentInstance = instances[activeInstance]
  const escapeRoom = useLiveQuizEscapeRoom({
    blockId,
    config: escapeRoomConfig,
    initialAttempt: initialEscapeRoomAttempt,
    instances,
    currentInstance,
    refetch: refetchLiveQuiz,
  })
  const responseStorageQuizId = escapeRoom.attempt?.id
    ? `${quizId}-escape-${escapeRoom.attempt.id}`
    : quizId
  const renderedAttemptIdRef = useRef(initialEscapeRoomAttempt?.id ?? null)

  useEffect(() => {
    const nextAttemptId = escapeRoom.attempt?.id ?? null
    if (renderedAttemptIdRef.current === nextAttemptId) return

    renderedAttemptIdRef.current = nextAttemptId
    setRemainingQuestions(null)
    setActiveInstance(0)
  }, [escapeRoom.attempt?.id])

  // initialize student response with default state (FT question) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.FreeText,
      response: undefined,
      valid: false,
    })

  // hook running on every instance change to initialize the student response correctly
  useSingleStudentResponse({
    instance: currentInstance,
    setStudentResponse,
    resetKey: responseStorageQuizId,
  })

  // keep a ref to the latest studentResponse for autosave
  const latestStudentResponseRef =
    useRef<InstanceStackStudentResponseType>(studentResponse)
  useEffect(() => {
    latestStudentResponseRef.current = studentResponse
  }, [studentResponse])

  useEffect(() => {
    // load the stored student response from the temporary or submission storage
    // guard against race conditions by cancelling stale async completions
    let cancelled = false
    const safeSetStudentResponse: typeof setStudentResponse = (value) => {
      if (cancelled) return
      setStudentResponse(value as any)
    }

    // reset submittedAt when switching instances; will be set again if stored exists
    setSubmittedAt(null)

    loadStoredResponse({
      quizId: responseStorageQuizId,
      execution,
      currentInstance,
      setStudentResponse: safeSetStudentResponse,
      setSubmittedAt,
    })

    return () => {
      cancelled = true
    }

    // re-run when quizId/execution/instance changes
  }, [responseStorageQuizId, execution, currentInstance?.id])

  // periodically store the in-progress response in a temporary key
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined

    const setupInterval = async () => {
      // if no instance exists, return early
      if (!currentInstance) return

      // if the answer to this instance has already been submitted, do not store a temporary response
      const storageKey = `lq-${responseStorageQuizId}-ex-${execution}-i-${currentInstance.id}`
      const stored = await localforage.getItem(storageKey)
      if (stored) return

      const key = `lq-${responseStorageQuizId}-ex-${execution}-i-${currentInstance.id}-temp`
      interval = setInterval(async () => {
        const latest = latestStudentResponseRef.current
        // only persist if there is something to store
        if (typeof latest?.response !== 'undefined') {
          // save raw response as temporary draft
          await localforage.setItem(key, latest.response as any)
        }
      }, 10000) // 10 seconds
    }

    setupInterval()

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [responseStorageQuizId, execution, currentInstance?.id])

  // compute remaining instances based on stored responses
  useRemainingInstances({
    quizId: responseStorageQuizId,
    instances,
    execution,
    isBlockCompleted: !isBlockActive,
    setRemainingQuestions,
    setActiveInstance,
  })

  const onSubmit = async (): Promise<void> => {
    if (escapeRoom.lockoutRemaining > 0) return
    // lock the submission button temporarily to avoid double submissions
    setSubmitting(true)

    const {
      id: instanceId,
      elementType,
      correlationKey,
    } = instances[activeInstance]

    // if the question has been answered, add a response
    const success = await answerQuestion({
      instanceId,
      type: elementType,
      input: studentResponse,
      correlationKey,
    })

    // relese the submission lock on the submission button
    setSubmitting(false)

    // if the submission was not successful, do not block another submission attempt
    if (!success) return

    // update the stored responses
    await updateStoredResponses(instanceId, responseStorageQuizId, execution)

    if (escapeRoomConfig && refetchLiveQuiz) {
      await refetchLiveQuiz()
      return
    }

    // calculate the new indices of remaining questions
    const newRemaining = (remainingQuestions ?? []).filter(
      (question) => !isDeepEqual(activeInstance, question)
    )

    // update the active instance and the remaining questions
    setActiveInstance(newRemaining[0] ?? instances.length - 1)
    setRemainingQuestions(newRemaining)

    // if this was the last question of the block and gamification is enabled, show confetti
    if (newRemaining.length === 0 && gamificationEnabled) {
      setShowConfetti(true)
    }
  }

  const onExpire = async (): Promise<void> => {
    const {
      id: instanceId,
      elementType,
      correlationKey,
    } = instances[activeInstance]

    // save the response, if one was given before the time expired
    if (studentResponse.valid) {
      answerQuestion({
        instanceId,
        type: elementType,
        input: studentResponse,
        correlationKey,
      })
    }

    const remainingQuestionIds = (remainingQuestions ?? []).map(
      (index: number) => instances[index].id
    )
    await updateStoredResponses(
      remainingQuestionIds,
      responseStorageQuizId,
      execution
    )

    // automatically skip all possibly remaining questions
    setRemainingQuestions([])
    setActiveInstance(instances.length - 1)

    // if the live quiz is gamified, show a confetti explosion
    if (gamificationEnabled) {
      setShowConfetti(true)
    }

    push(['trackEvent', 'Live Quiz', 'Time expired'])
  }

  function showStatusCodeToast(statusCode: number, responseStatus?: string) {
    if (responseStatus === 'incorrect') {
      toast({
        message: t('pwa.practiceQuiz.escapeRoomIncorrectToast'),
        type: 'error',
      })
      return
    }
    if (statusCode === 429) {
      toast({
        message: t('pwa.practiceQuiz.escapeRoomLockoutToast'),
        type: 'error',
      })
      return
    }

    // status code 200 (regular and assessment responses) -> successful submission
    if (statusCode === 200) {
      toast({
        message: t('pwa.assessment.submissionSuccessful'),
        type: 'success',
      })
    }
    // status code 208 (assessment responses) -> already recorded
    else if (statusCode === 208) {
      toast({
        message: t('pwa.assessment.submissionAlreadyRecorded'),
        type: 'success',
      })
    }
    // status code 400 (regular and assessment responses) -> invalid request
    else if (statusCode === 400) {
      toast({
        message: t('pwa.assessment.submissionGeneralError'),
        type: 'error',
      })
    }
    // status code 401 (assessment responses) -> unauthorized
    else if (statusCode === 401) {
      toast({
        message: t('pwa.assessment.submissionUnauthorizedError'),
        type: 'error',
      })
    }
    // status code 404 (regular and assessment responses) -> submission endpoint not found
    else if (statusCode === 404) {
      toast({
        message: t('pwa.assessment.submissionGeneralError'),
        type: 'error',
      })
    }
    // status code 500 (regular responses) -> server error
    else if (statusCode === 500) {
      toast({
        message: t('pwa.assessment.submissionServerError'),
        type: 'error',
      })
    }
  }

  async function submitLiveQuizResponse(
    input: Parameters<QuestionAreaProps['handleNewResponse']>[0]
  ) {
    const result = await handleNewResponse(input)
    showStatusCodeToast(result.statusCode, result.responseStatus)
    escapeRoom.onResponse(result)
    return result
  }

  // use the handleNewResponse function to add a response to the question instance
  // return value is status code: 0 = success, 1 = invalid input, 2 = submission failed, 3 = unsupported type
  async function answerQuestion({
    instanceId,
    type,
    input,
    correlationKey,
  }: {
    instanceId: number
    type: ElementType
    input: InstanceStackStudentResponseType
    correlationKey?: string | null
  }): Promise<boolean> {
    const storageKey = `lq-${responseStorageQuizId}-ex-${execution}-i-${instanceId}`

    if (!input.valid) {
      toast({
        message: t('pwa.assessment.submissionInputsInvalid'),
        type: 'error',
      })
      return false
    } else if (
      ((type === ElementType.Sc && input.type === ElementType.Sc) ||
        (type === ElementType.Mc && input.type === ElementType.Mc) ||
        (type === ElementType.Kprim && input.type === ElementType.Kprim)) &&
      typeof input.response !== 'undefined'
    ) {
      // submit responses as an array of objects with answer ix and selected boolean
      const result = await submitLiveQuizResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: Object.entries(input.response).map(([key, value]) => ({
          ix: parseInt(key),
          selected: typeof value === 'boolean' ? value : false,
        })),
        correlationKey,
      })
      // if request was successful, store the submitted answer locally to be shown and remove any temporary saved response
      if (
        result.statusCode >= 200 &&
        result.statusCode < 300 &&
        result.responseStatus !== 'incorrect'
      ) {
        // store the submitted answer locally to be shown and remove any temporary saved response
        await localforage.setItem(storageKey, {
          response: input.response,
          responseTimestamp: result.responseTimestamp ?? Date.now(),
        } as any)
        setSubmittedAt(result.responseTimestamp ?? Date.now())
        await localforage.removeItem(`${storageKey}-temp`)
        return true
      } else {
        return false
      }
    } else if (
      ElementType.FreeText === type &&
      input.type === ElementType.FreeText &&
      typeof input.response !== 'undefined'
    ) {
      // submit responses as a string
      const result = await submitLiveQuizResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: input.response,
        correlationKey,
      })

      if (
        result.statusCode >= 200 &&
        result.statusCode < 300 &&
        result.responseStatus !== 'incorrect'
      ) {
        await localforage.setItem(storageKey, {
          response: input.response,
          responseTimestamp: result.responseTimestamp ?? Date.now(),
        } as any)
        setSubmittedAt(result.responseTimestamp ?? Date.now())
        await localforage.removeItem(`${storageKey}-temp`)
        return true
      } else {
        return false
      }
    } else if (
      ElementType.QrScan === type &&
      input.type === ElementType.QrScan &&
      typeof input.response !== 'undefined'
    ) {
      const result = await submitLiveQuizResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: input.response,
        correlationKey,
      })

      if (
        result.statusCode >= 200 &&
        result.statusCode < 300 &&
        result.responseStatus !== 'incorrect'
      ) {
        await localforage.setItem(storageKey, {
          response: input.response,
          responseTimestamp: result.responseTimestamp ?? Date.now(),
        } as any)
        setSubmittedAt(result.responseTimestamp ?? Date.now())
        await localforage.removeItem(`${storageKey}-temp`)
        return true
      }
      return false
    } else if (
      ElementType.Numerical === type &&
      input.type === ElementType.Numerical &&
      typeof input.response !== 'undefined'
    ) {
      // submit responses as a number (float)
      const result = await submitLiveQuizResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: String(parseFloat(input.response)),
        correlationKey,
      })

      if (
        result.statusCode >= 200 &&
        result.statusCode < 300 &&
        result.responseStatus !== 'incorrect'
      ) {
        await localforage.setItem(storageKey, {
          response: input.response,
          responseTimestamp: result.responseTimestamp ?? Date.now(),
        } as any)
        setSubmittedAt(result.responseTimestamp ?? Date.now())
        await localforage.removeItem(`${storageKey}-temp`)
        return true
      } else {
        return false
      }
    } else if (
      ElementType.Selection === type &&
      input.type === ElementType.Selection &&
      typeof input.response !== 'undefined'
    ) {
      // submit responses as an array of answer ids that were selected
      const result = await submitLiveQuizResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: Object.values(input.response).map((entry) =>
          typeof entry === 'undefined' || entry === null ? -1 : entry
        ),
        correlationKey,
      })

      if (
        result.statusCode >= 200 &&
        result.statusCode < 300 &&
        result.responseStatus !== 'incorrect'
      ) {
        await localforage.setItem(storageKey, {
          response: input.response,
          responseTimestamp: result.responseTimestamp ?? Date.now(),
        } as any)
        setSubmittedAt(result.responseTimestamp ?? Date.now())
        await localforage.removeItem(`${storageKey}-temp`)
        return true
      } else {
        return false
      }
    } else if (
      ElementType.CaseStudy === type &&
      input.type === ElementType.CaseStudy &&
      typeof input.response !== 'undefined'
    ) {
      // submit responses as an object with case, item and criterion ids as nested keys
      const result = await submitLiveQuizResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: input.response,
        correlationKey,
      })

      if (
        result.statusCode >= 200 &&
        result.statusCode < 300 &&
        result.responseStatus !== 'incorrect'
      ) {
        await localforage.setItem(storageKey, {
          response: input.response,
          responseTimestamp: result.responseTimestamp ?? Date.now(),
        } as any)
        setSubmittedAt(result.responseTimestamp ?? Date.now())
        await localforage.removeItem(`${storageKey}-temp`)
        return true
      } else {
        return false
      }
    } else if (type === ElementType.Content) {
      // for content elements, only the number of reads / next clicks are counted
      const result = await submitLiveQuizResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: true,
        correlationKey,
      })

      if (
        result.statusCode >= 200 &&
        result.statusCode < 300 &&
        result.responseStatus !== 'incorrect'
      ) {
        await localforage.setItem(storageKey, {
          response: input.response,
          responseTimestamp: result.responseTimestamp ?? Date.now(),
        } as any)
        setSubmittedAt(result.responseTimestamp ?? Date.now())
        await localforage.removeItem(`${storageKey}-temp`)
        return true
      } else {
        return false
      }
    } else {
      console.log('Submission for unsupported element type', type)
      toast({
        message: t('pwa.assessment.submissionGeneralError'),
        type: 'error',
      })
      return false
    }
  }

  const escapeRoomOverlay = escapeRoomConfig ? (
    <LiveQuizEscapeRoomOverlay
      controller={escapeRoom}
      config={escapeRoomConfig}
      clearedInstances={
        escapeRoomClearedInstances ??
        instances.length - (remainingQuestions?.length ?? 0)
      }
      totalInstances={escapeRoomTotalInstances ?? instances.length}
    />
  ) : null

  if (escapeRoomConfig && instances.length === 0) {
    return (
      <div className="min-h-content relative h-full">{escapeRoomOverlay}</div>
    )
  }

  // Escape-room instances are hidden until the attempt starts. Wait for the
  // active index to catch up when the first visible instance arrives.
  if (remainingQuestions === null || !currentInstance) {
    return <></>
  }

  return (
    <div className="min-h-content relative mt-1.5 h-full w-full">
      {escapeRoomOverlay}
      <div className="flex flex-row items-center justify-between">
        <H2 className={{ root: 'mb-0 pt-2' }}>
          {t('shared.generic.questions')}
        </H2>
        {submittedAt ? (
          <div className="mb-0.5 mt-1 flex items-center gap-2 self-end text-sm text-green-700">
            <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
            <span>
              {t('pwa.assessment.respondedAt', {
                date: dayjs(submittedAt).format('DD.MM.YYYY HH:mm'),
              })}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex w-full flex-col">
        {remainingQuestions.length === 0 && (
          <UserNotification
            type="success"
            className={{ root: 'mt-1.5 md:text-base' }}
            message={t('pwa.liveQuiz.allQuestionsAnswered')}
          />
        )}
        {showConfetti ? (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
            <ConfettiExplosion duration={2000} />
          </div>
        ) : null}

        <LiveQuizProgress
          activeIndex={activeInstance}
          numItems={instances.length}
          expiresAt={expiresAt}
          timeLimit={timeLimit}
          allowedMaxIndex={
            isBlockActive
              ? typeof remainingQuestions[0] === 'number'
                ? (remainingQuestions[0] as number)
                : instances.length - 1
              : instances.length - 1
          }
          isCurrentUnanswered={remainingQuestions.includes(activeInstance)}
          isContent={currentInstance.elementType === ElementType.Content}
          isBlockOver={remainingQuestions.length === 0}
          canSubmit={
            !!studentResponse.valid &&
            !submitting &&
            escapeRoom.lockoutRemaining === 0
          }
          onPrev={() => setActiveInstance((prev) => Math.max(0, prev - 1))}
          onNext={() =>
            setActiveInstance((prev) =>
              Math.min(
                isBlockActive
                  ? typeof remainingQuestions[0] === 'number'
                    ? (remainingQuestions[0] as number)
                    : instances.length - 1
                  : instances.length - 1,
                prev + 1
              )
            )
          }
          onSubmit={onSubmit}
          onExpire={onExpire}
        />

        <StudentElement
          sequential
          hideReadButton
          disabledInput={
            !isBlockActive || !remainingQuestions.includes(activeInstance)
          }
          element={currentInstance}
          elementIx={activeInstance}
          singleStudentResponse={studentResponse}
          setSingleStudentResponse={setStudentResponse}
        />
        {escapeRoomConfig && (
          <LiveQuizEscapeRoomQuestionControls
            controller={escapeRoom}
            config={escapeRoomConfig}
            currentInstance={currentInstance}
          />
        )}
      </div>
    </div>
  )
}

export default QuestionArea
