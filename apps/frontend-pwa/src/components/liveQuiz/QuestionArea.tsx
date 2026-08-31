import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CodeSubmissionStatus,
  ElementInstance,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
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
import useComponentVisibleCounter from '../hooks/useComponentVisibleCounter'
import useRemainingInstances from '../hooks/useRemainingInstances'
import CodeSubmissionStatusPanel from '../practiceQuiz/CodeSubmissionStatus'
import useCodeSubmission from '../practiceQuiz/useCodeSubmission'
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
  }) => Promise<{ statusCode: number; responseTimestamp?: number }>
  quizId: string
  execution: number
  courseId?: string
  participantId?: string
  codeSubmissionEnabled?: boolean
  timeLimit?: number
  isStaticPreview?: boolean
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
  courseId,
  participantId,
  codeSubmissionEnabled = false,
}: QuestionAreaProps): React.ReactElement {
  const t = useTranslations()
  const timeRef = useRef(0)
  useComponentVisibleCounter({ timeRef })

  const [showConfetti, setShowConfetti] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [remainingQuestions, setRemainingQuestions] = useState<number[] | null>(
    null
  )

  const [submittedAt, setSubmittedAt] = useState<number | null>(null)
  const [activeInstance, setActiveInstance] = useState<number>(0)
  const currentInstance = instances[activeInstance]
  const currentInstanceIsCode =
    currentInstance?.elementType === ElementType.Code
  const codeSubmissionAvailable =
    currentInstanceIsCode &&
    codeSubmissionEnabled &&
    !!courseId &&
    !!participantId
  const completedCodeReceiptRef = useRef<string | null>(null)
  const {
    submission: codeSubmission,
    submit: submitCodeResponse,
    submitting: submittingCodeResponse,
    submissionError: codeSubmissionError,
    pollingError: codePollingError,
    retryPolling: retryCodePolling,
    active: codeSubmissionActive,
  } = useCodeSubmission({
    storageKey: `code-submission-live-${quizId}-${execution}-${currentInstance?.id ?? 'none'}`,
    enabled: codeSubmissionAvailable,
    participantId,
  })

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
      quizId,
      execution,
      currentInstance,
      setStudentResponse: safeSetStudentResponse,
      setSubmittedAt,
      participantId,
    })

    return () => {
      cancelled = true
    }

    // re-run when quizId/execution/instance changes
  }, [quizId, execution, currentInstance?.id, participantId])

  useEffect(() => {
    if (
      !currentInstanceIsCode ||
      !codeSubmission?.code ||
      codeSubmission.gradingStatus === CodeSubmissionStatus.Failed
    ) {
      return
    }

    setStudentResponse({
      type: ElementType.Code,
      response: codeSubmission.code,
      valid: codeSubmission.code.length > 0,
    })
  }, [
    codeSubmission?.code,
    codeSubmission?.gradingStatus,
    currentInstanceIsCode,
  ])

  useEffect(() => {
    if (
      !currentInstance ||
      !currentInstanceIsCode ||
      !participantId ||
      !codeSubmission ||
      codeSubmission.gradingStatus !== CodeSubmissionStatus.Completed ||
      completedCodeReceiptRef.current === codeSubmission.receiptId
    ) {
      return
    }
    completedCodeReceiptRef.current = codeSubmission.receiptId

    void (async () => {
      const responseTimestamp = Date.now()
      const storageKey = `lq-${quizId}-p-${participantId}-ex-${execution}-i-${currentInstance.id}`
      await localforage.setItem(storageKey, {
        response: codeSubmission.code,
        responseTimestamp,
      })
      await localforage.removeItem(`${storageKey}-temp`)
      await updateStoredResponses(
        currentInstance.id,
        quizId,
        execution,
        participantId
      )
      setSubmittedAt(responseTimestamp)
      setRemainingQuestions((current) =>
        (current ?? []).filter((question) => question !== activeInstance)
      )
      if (gamificationEnabled) setShowConfetti(true)
    })()
  }, [
    activeInstance,
    codeSubmission,
    currentInstance,
    currentInstanceIsCode,
    execution,
    gamificationEnabled,
    participantId,
    quizId,
  ])

  // periodically store the in-progress response in a temporary key
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined

    const setupInterval = async () => {
      // if no instance exists, return early
      if (!currentInstance) return

      // if the answer to this instance has already been submitted, do not store a temporary response
      if (currentInstance.elementType === ElementType.Code && !participantId) {
        return
      }
      const participantScope =
        currentInstance.elementType === ElementType.Code
          ? `-p-${participantId}`
          : ''
      const storageKey = `lq-${quizId}${participantScope}-ex-${execution}-i-${currentInstance.id}`
      const stored = await localforage.getItem(storageKey)
      if (stored) return

      const key = `${storageKey}-temp`
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
  }, [quizId, execution, currentInstance?.id, participantId])

  // compute remaining instances based on stored responses
  useRemainingInstances({
    quizId,
    instances,
    execution,
    isBlockCompleted: !isBlockActive,
    setRemainingQuestions,
    setActiveInstance,
    participantId,
  })

  const onSubmit = async (): Promise<void> => {
    // lock the submission button temporarily to avoid double submissions
    setSubmitting(true)

    const {
      id: instanceId,
      elementType,
      correlationKey,
    } = instances[activeInstance]

    if (elementType === ElementType.Code) {
      const code =
        studentResponse.type === ElementType.Code &&
        typeof studentResponse.response === 'string'
          ? studentResponse.response
          : null
      const accepted =
        code && codeSubmissionAvailable && courseId
          ? await submitCodeResponse({
              instanceId,
              courseId,
              code,
              timeSpent: timeRef.current,
            })
          : false
      setSubmitting(false)
      if (!accepted) {
        toast({
          message: t('pwa.practiceQuiz.codeSubmissionFailed'),
          type: 'error',
        })
      }
      return
    }

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
    await updateStoredResponses(instanceId, quizId, execution)

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

    // CODE stays pending until its receipt completes; expiry must not mark it
    // answered before grading has finished.
    if (elementType === ElementType.Code) {
      if (
        studentResponse.type === ElementType.Code &&
        typeof studentResponse.response === 'string' &&
        codeSubmissionAvailable &&
        courseId &&
        !codeSubmissionActive
      ) {
        const accepted = await submitCodeResponse({
          instanceId,
          courseId,
          code: studentResponse.response,
          timeSpent: timeRef.current,
        })
        if (!accepted) {
          toast({
            message: t('pwa.practiceQuiz.codeSubmissionFailed'),
            type: 'error',
          })
        }
      }
      push(['trackEvent', 'Live Quiz', 'Time expired'])
      return
    }

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
    await updateStoredResponses(remainingQuestionIds, quizId, execution)

    // automatically skip all possibly remaining questions
    setRemainingQuestions([])
    setActiveInstance(instances.length - 1)

    // if the live quiz is gamified, show a confetti explosion
    if (gamificationEnabled) {
      setShowConfetti(true)
    }

    push(['trackEvent', 'Live Quiz', 'Time expired'])
  }

  function showStatusCodeToast(statusCode: number) {
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
    const storageKey = `lq-${quizId}-ex-${execution}-i-${instanceId}`

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
      const result = await handleNewResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: Object.entries(input.response).map(([key, value]) => ({
          ix: parseInt(key),
          selected: typeof value === 'boolean' ? value : false,
        })),
        correlationKey,
      })

      // --> show toast based on status code
      showStatusCodeToast(result.statusCode)

      // if request was successful, store the submitted answer locally to be shown and remove any temporary saved response
      if (result.statusCode >= 200 && result.statusCode < 300) {
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
      const result = await handleNewResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: input.response,
        correlationKey,
      })

      // --> show toast based on status code
      showStatusCodeToast(result.statusCode)

      if (result.statusCode >= 200 && result.statusCode < 300) {
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
      ElementType.Numerical === type &&
      input.type === ElementType.Numerical &&
      typeof input.response !== 'undefined'
    ) {
      // submit responses as a number (float)
      const result = await handleNewResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: String(parseFloat(input.response)),
        correlationKey,
      })

      // --> show toast based on status code
      showStatusCodeToast(result.statusCode)

      if (result.statusCode >= 200 && result.statusCode < 300) {
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
      const result = await handleNewResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: Object.values(input.response).map((entry) =>
          typeof entry === 'undefined' || entry === null ? -1 : entry
        ),
        correlationKey,
      })

      // --> show toast based on status code
      showStatusCodeToast(result.statusCode)

      if (result.statusCode >= 200 && result.statusCode < 300) {
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
      const result = await handleNewResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: input.response,
        correlationKey,
      })

      // --> show toast based on status code
      showStatusCodeToast(result.statusCode)

      if (result.statusCode >= 200 && result.statusCode < 300) {
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
      const result = await handleNewResponse({
        liveQuizId: quizId,
        instanceId,
        type,
        answer: true,
        correlationKey,
      })

      // --> show toast based on status code
      showStatusCodeToast(result.statusCode)

      if (result.statusCode >= 200 && result.statusCode < 300) {
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

  // while the remaining questions are still initializing, do not return anything
  if (remainingQuestions === null) {
    return <></>
  }

  return (
    <div className="min-h-content relative mt-1.5 h-full w-full">
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
            !submittingCodeResponse &&
            (!currentInstanceIsCode ||
              (codeSubmissionAvailable &&
                !codeSubmissionActive &&
                codeSubmission?.gradingStatus !==
                  CodeSubmissionStatus.Completed))
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
            !isBlockActive ||
            !remainingQuestions.includes(activeInstance) ||
            (currentInstanceIsCode &&
              (!codeSubmissionAvailable ||
                codeSubmissionActive ||
                codeSubmission?.gradingStatus ===
                  CodeSubmissionStatus.Completed))
          }
          element={currentInstance}
          elementIx={activeInstance}
          singleStudentResponse={studentResponse}
          setSingleStudentResponse={setStudentResponse}
        />
        {currentInstanceIsCode && codeSubmission ? (
          <CodeSubmissionStatusPanel
            submission={codeSubmission}
            pollingUnavailable={!!codePollingError}
            retryPolling={retryCodePolling}
          />
        ) : null}
        {currentInstanceIsCode && !codeSubmissionAvailable ? (
          <div className="mt-4" data-cy="live-quiz-code-unavailable">
            <UserNotification
              type="warning"
              message={t('pwa.liveQuiz.codeSubmissionUnavailable')}
            />
          </div>
        ) : null}
        {currentInstanceIsCode && codeSubmissionError && !codeSubmission ? (
          <div className="mt-4" data-cy="code-submission-failed">
            <UserNotification
              type="error"
              message={t('pwa.practiceQuiz.codeSubmissionFailed')}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default QuestionArea
