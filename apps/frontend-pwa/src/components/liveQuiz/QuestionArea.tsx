import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementInstance, ElementType } from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import useAuditClient from '@klicker-uzh/shared-components/src/hooks/useAuditClient'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import LiveQuizProgress from '@klicker-uzh/shared-components/src/questions/LiveQuizProgress'
import { AuditAction, AuditScope } from '@klicker-uzh/types'
import { push } from '@socialgouv/matomo-next'
import { H2, toast, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localforage from 'localforage'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import React, { useEffect, useRef, useState } from 'react'
import { isDeepEqual } from 'remeda'
import useRemainingInstances from '../hooks/useRemainingInstances'
import { loadStoredResponse, updateStoredResponses } from './storageHelpers'

const ConfettiExplosion = dynamic(() => import('react-confetti-explosion'), {
  ssr: false,
})

const MAX_AUDIT_PREVIEW_LENGTH = 200

const serializeResponse = (value: unknown): string | null => {
  if (value === null || typeof value === 'undefined') return null
  try {
    return JSON.stringify(value)
  } catch (error) {
    try {
      return String(value)
    } catch (stringifyError) {
      console.warn('Failed to serialize response for audit log')
      return null
    }
  }
}

const buildResponsePreview = (value: unknown): string | undefined => {
  const serialized = serializeResponse(value)
  if (!serialized) return undefined
  if (serialized.length <= MAX_AUDIT_PREVIEW_LENGTH) {
    return serialized
  }
  return `${serialized.slice(0, MAX_AUDIT_PREVIEW_LENGTH)}…`
}

const calculateDiffSize = (previous: string | null, next: string | null) => {
  return Math.abs((next?.length ?? 0) - (previous?.length ?? 0))
}

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
  isStaticPreview = false,
}: QuestionAreaProps): React.ReactElement {
  const t = useTranslations()

  const isAssessmentMode = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'

  const auditLog = useAuditClient({
    assessmentMode: isAssessmentMode,
    enabled: isAssessmentMode,
    onError: (error) => {
      console.error('Audit log error:', error)
    },
  })

  const [showConfetti, setShowConfetti] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [remainingQuestions, setRemainingQuestions] = useState<number[] | null>(
    null
  )

  const [submittedAt, setSubmittedAt] = useState<number | null>(null)
  const [activeInstance, setActiveInstance] = useState<number>(0)
  const currentInstance = instances[activeInstance]

  const joinEventLoggedRef = useRef(false)
  const viewedInstancesRef = useRef<Set<number>>(new Set())
  const lastLoggedResponseRef = useRef<Record<number, string | null>>({})

  // initialize student response with default state (FT question) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.FreeText,
      response: undefined,
      valid: false,
    })

  useEffect(() => {
    viewedInstancesRef.current.clear()
    lastLoggedResponseRef.current = {}
  }, [quizId, execution])

  useEffect(() => {
    joinEventLoggedRef.current = false
  }, [quizId])

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

    if (!currentInstance) {
      return () => {
        cancelled = true
      }
    }

    delete lastLoggedResponseRef.current[currentInstance.id]

    loadStoredResponse({
      quizId,
      execution,
      currentInstance,
      setStudentResponse: safeSetStudentResponse,
      setSubmittedAt,
      onLoaded: (details) => {
        if (cancelled || !currentInstance) return

        if (!details) {
          delete lastLoggedResponseRef.current[currentInstance.id]
          return
        }

        const serialized = serializeResponse(details.response)
        if (serialized !== null) {
          lastLoggedResponseRef.current[currentInstance.id] = serialized
        } else {
          lastLoggedResponseRef.current[currentInstance.id] = null
        }
      },
    })

    return () => {
      cancelled = true
    }

    // re-run when quizId/execution/instance changes
  }, [quizId, execution, currentInstance])

  // periodically store the in-progress response in a temporary key and log assessment updates
  useEffect(() => {
    if (typeof window === 'undefined') return

    let interval: ReturnType<typeof setInterval> | undefined

    const setupInterval = async () => {
      if (!currentInstance) return

      const { id: instanceId, correlationKey, elementType } = currentInstance

      // if the answer to this instance has already been submitted, do not store a temporary response
      const storageKey = `lq-${quizId}-ex-${execution}-i-${instanceId}`
      const stored = await localforage.getItem(storageKey)
      if (stored) return

      const key = `lq-${quizId}-ex-${execution}-i-${instanceId}-temp`
      interval = setInterval(async () => {
        const latest = latestStudentResponseRef.current

        if (typeof latest?.response === 'undefined') {
          return
        }

        await localforage.setItem(key, latest.response as any)

        if (!isAssessmentMode || isStaticPreview) {
          return
        }

        const serialized = serializeResponse(latest.response)
        if (!serialized) return

        const previous = lastLoggedResponseRef.current[instanceId] ?? null

        if (serialized !== previous) {
          const changeType = previous ? 'update' : 'initial'
          const diffChars = calculateDiffSize(previous, serialized)

          auditLog.logAsync({
            action: AuditAction.PARTICIPANT_UPDATE_ANSWER,
            scope: AuditScope.PUBLIC,
            resource: `instance:${instanceId}`,
            correlationId: correlationKey ?? undefined,
            attributes: {
              changeType,
              diffChars,
              responseLength: serialized.length,
              responsePreview: buildResponsePreview(latest.response),
              elementType,
              execution,
            },
          })

          lastLoggedResponseRef.current[instanceId] = serialized
        }
      }, 10000)
    }

    setupInterval()

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [
    auditLog,
    currentInstance,
    execution,
    isAssessmentMode,
    isStaticPreview,
    quizId,
  ])

  useEffect(() => {
    if (!isAssessmentMode || isStaticPreview) return
    if (!quizId || joinEventLoggedRef.current) return

    auditLog.logAsync({
      action: AuditAction.PARTICIPANT_JOIN_QUIZ,
      scope: AuditScope.PUBLIC,
      resource: `live-quiz:${quizId}`,
      attributes: {
        execution,
        timestamp: Date.now(),
      },
    })

    joinEventLoggedRef.current = true
  }, [auditLog, execution, isAssessmentMode, isStaticPreview, quizId])

  useEffect(() => {
    if (!isAssessmentMode || isStaticPreview) return
    if (!currentInstance) return

    const instanceId = currentInstance.id
    if (viewedInstancesRef.current.has(instanceId)) return

    auditLog.logAsync({
      action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
      scope: AuditScope.PUBLIC,
      resource: `instance:${instanceId}`,
      correlationId: currentInstance.correlationKey ?? undefined,
      attributes: {
        elementType: currentInstance.elementType,
        execution,
        questionIndex: activeInstance,
        totalInstances: instances.length,
        blockActive: isBlockActive,
      },
    })

    viewedInstancesRef.current.add(instanceId)
  }, [
    activeInstance,
    auditLog,
    currentInstance,
    execution,
    instances,
    isAssessmentMode,
    isBlockActive,
    isStaticPreview,
  ])

  // compute remaining instances based on stored responses
  useRemainingInstances({
    quizId,
    instances,
    execution,
    isBlockCompleted: !isBlockActive,
    setRemainingQuestions,
    setActiveInstance,
  })

  const onSubmit = async (): Promise<void> => {
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

  const logResponseSubmission = ({
    instanceId,
    correlationKey,
    elementType,
    response,
    statusCode,
    responseTimestamp,
  }: {
    instanceId: number
    correlationKey?: string | null
    elementType: ElementType
    response: unknown
    statusCode: number
    responseTimestamp?: number
  }) => {
    if (!isAssessmentMode || isStaticPreview) {
      return
    }

    const serialized = serializeResponse(response)

    auditLog.logAsync({
      action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
      scope: AuditScope.PUBLIC,
      resource: `instance:${instanceId}`,
      correlationId: correlationKey ?? undefined,
      attributes: {
        statusCode,
        success: statusCode >= 200 && statusCode < 300,
        responseTimestamp: responseTimestamp ?? Date.now(),
        elementType,
        execution,
        responseLength: serialized?.length ?? 0,
        responsePreview: buildResponsePreview(response),
      },
    })
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
    }

    let requestAnswer: any

    if (
      ((type === ElementType.Sc && input.type === ElementType.Sc) ||
        (type === ElementType.Mc && input.type === ElementType.Mc) ||
        (type === ElementType.Kprim && input.type === ElementType.Kprim)) &&
      typeof input.response !== 'undefined'
    ) {
      requestAnswer = Object.entries(input.response).map(([key, value]) => ({
        ix: parseInt(key),
        selected: typeof value === 'boolean' ? value : false,
      }))
    } else if (
      ElementType.FreeText === type &&
      input.type === ElementType.FreeText &&
      typeof input.response !== 'undefined'
    ) {
      requestAnswer = input.response
    } else if (
      ElementType.Numerical === type &&
      input.type === ElementType.Numerical &&
      typeof input.response !== 'undefined'
    ) {
      requestAnswer = String(parseFloat(input.response))
    } else if (
      ElementType.Selection === type &&
      input.type === ElementType.Selection &&
      typeof input.response !== 'undefined'
    ) {
      requestAnswer = Object.values(input.response).map((entry) =>
        typeof entry === 'undefined' || entry === null ? -1 : entry
      )
    } else if (
      ElementType.CaseStudy === type &&
      input.type === ElementType.CaseStudy &&
      typeof input.response !== 'undefined'
    ) {
      requestAnswer = input.response
    } else if (type === ElementType.Content) {
      requestAnswer = true
    } else {
      console.log('Submission for unsupported element type', type)
      toast({
        message: t('pwa.assessment.submissionGeneralError'),
        type: 'error',
      })
      return false
    }

    const result = await handleNewResponse({
      liveQuizId: quizId,
      instanceId,
      type,
      answer: requestAnswer,
      correlationKey,
    })

    showStatusCodeToast(result.statusCode)

    const responseForAudit =
      typeof input.response !== 'undefined' ? input.response : requestAnswer

    logResponseSubmission({
      instanceId,
      correlationKey,
      elementType: type,
      response: responseForAudit,
      statusCode: result.statusCode,
      responseTimestamp: result.responseTimestamp,
    })

    if (result.statusCode >= 200 && result.statusCode < 300) {
      await localforage.setItem(storageKey, {
        response: input.response,
        responseTimestamp: result.responseTimestamp ?? Date.now(),
      } as any)
      setSubmittedAt(result.responseTimestamp ?? Date.now())
      await localforage.removeItem(`${storageKey}-temp`)

      const serialized = serializeResponse(responseForAudit)
      if (serialized !== null) {
        lastLoggedResponseRef.current[instanceId] = serialized
      }

      return true
    }

    return false
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
          canSubmit={!!studentResponse.valid && !submitting}
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
      </div>
    </div>
  )
}

export default QuestionArea
