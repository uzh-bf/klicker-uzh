import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import {
  type Course,
  DecideSemanticEvaluationConsentDocument,
  GetBookmarksPracticeQuizDocument,
  type PracticeQuiz as PracticeQuizType,
  SelfDocument,
  SemanticFreeTextCapabilityDocument,
  StackFeedbackStatus,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../common/PreviewMessage'
import StepProgressWithScoring from '../common/StepProgressWithScoring'
import ElementStack from './ElementStack'
import PracticeQuizOverview from './PracticeQuizOverview'
import SemanticEvaluationConsentModal from './SemanticEvaluationConsentModal'

export const FEEDBACK_STATUS_PROGRESS_MAP: Record<
  StackFeedbackStatus,
  'correct' | 'unanswered' | 'incorrect' | 'partial' | undefined
> = {
  [StackFeedbackStatus.Correct]: 'correct',
  [StackFeedbackStatus.Incorrect]: 'incorrect',
  [StackFeedbackStatus.Partial]: 'partial',
  [StackFeedbackStatus.Unanswered]: 'unanswered',
  [StackFeedbackStatus.ManuallyGraded]: 'unanswered',
}

export function resetPracticeQuizLocalStorage(id: string) {
  const localStorageKeys = Object.keys(localStorage)
  localStorageKeys.forEach((key) => {
    if (key.includes(id)) {
      localStorage.removeItem(key)
    }
  })
}

interface PracticeQuizProps {
  quiz: Omit<PracticeQuizType, 'course'> & { course: Pick<Course, 'id'> }
  currentIx: number
  setCurrentIx: (ix: number) => void
  handleNextElement: () => void
  onAllStacksCompletion?: () => void
  showResetLocalStorage?: boolean
  embedded?: boolean
  previewOnly?: boolean
}

function PracticeQuiz({
  quiz,
  currentIx,
  setCurrentIx,
  handleNextElement,
  onAllStacksCompletion,
  showResetLocalStorage = false,
  embedded = false,
  previewOnly = false,
}: PracticeQuizProps) {
  const router = useRouter()
  const t = useTranslations()
  const currentStack = quiz.stacks?.[currentIx]
  const { data: dataParticipant, loading: participantLoading } = useQuery(
    SelfDocument,
    {
      skip: previewOnly,
    }
  )
  const hasSemanticEvaluation = useMemo(
    () =>
      quiz.stacks?.some((stack) =>
        stack.elements?.some(
          (element) =>
            element.elementData.__typename === 'FreeTextElementData' &&
            element.elementData.options.hasSemanticEvaluation
        )
      ) ?? false,
    [quiz.stacks]
  )
  const registeredParticipant =
    dataParticipant?.self?.role === UserRole.Participant
  const shouldGateSemanticEvaluation =
    hasSemanticEvaluation && !previewOnly && registeredParticipant
  const [
    loadSemanticCapability,
    { data: capabilityData, loading: capabilityLoading },
  ] = useLazyQuery(SemanticFreeTextCapabilityDocument, {
    fetchPolicy: 'network-only',
  })
  const [decideConsentMutation, consentResult] = useMutation(
    DecideSemanticEvaluationConsentDocument
  )
  const [consentTargetIx, setConsentTargetIx] = useState<number | null>(null)
  const quizStartRequestInFlight = useRef(false)
  const capability = capabilityData?.semanticFreeTextCapability
  const semanticGateLoading =
    hasSemanticEvaluation &&
    !previewOnly &&
    (participantLoading || capabilityLoading)

  const requestQuizStart = async (targetIx: number) => {
    if (semanticGateLoading || quizStartRequestInFlight.current) return
    if (!shouldGateSemanticEvaluation) {
      setCurrentIx(targetIx)
      return
    }

    quizStartRequestInFlight.current = true
    try {
      const { data } = await loadSemanticCapability()
      const currentCapability = data?.semanticFreeTextCapability

      if (!currentCapability || currentCapability.consentDecision) {
        setCurrentIx(targetIx)
        return
      }

      setConsentTargetIx(targetIx)
    } catch {
      // Capability failures preserve the deterministic exact-match fallback.
      setCurrentIx(targetIx)
    } finally {
      quizStartRequestInFlight.current = false
    }
  }

  const decideConsent = async (accepted: boolean) => {
    if (!capability || consentTargetIx === null) return

    try {
      await decideConsentMutation({
        variables: {
          disclosureVersion: capability.disclosureVersion,
          accepted,
        },
        refetchQueries: [SemanticFreeTextCapabilityDocument],
        awaitRefetchQueries: true,
      })
      const targetIx = consentTargetIx
      setConsentTargetIx(null)
      setCurrentIx(targetIx)
    } catch {
      // The open modal renders Apollo's mutation error and permits a retry.
    }
  }

  const setQuizStep = (targetIx: number) => {
    if (currentIx === -1 && targetIx >= 0) {
      void requestQuizStart(targetIx)
      return
    }

    setCurrentIx(targetIx)
  }

  const handleAllStacksCompletion = () => {
    if (onAllStacksCompletion) {
      onAllStacksCompletion()
      return
    }

    // TODO: re-introduce summary page for practice quiz
    router.push(`/`)
  }

  const [progressState, setProgressState] = useLocalStorage<
    Record<
      string,
      {
        status: StackFeedbackStatus
        score?: number | null
      }
    >
  >(
    `pq-${quiz.id}`,
    quiz.stacks?.reduce(
      (acc, stack) => ({
        ...acc,
        [stack.id]: {
          status: 'unanswered',
          score: null,
        },
      }),
      {}
    )
  )

  const { data: bookmarksData } = useQuery(GetBookmarksPracticeQuizDocument, {
    variables: {
      courseId: router.query.courseId as string,
      quizId: quiz.id === 'bookmarks' ? undefined : quiz.id,
    },
    skip:
      previewOnly ||
      !router.query.courseId ||
      !dataParticipant?.self ||
      dataParticipant?.self.role !== UserRole.Participant,
  })

  return (
    <div className="flex-1">
      <div
        className={twMerge(
          'w-full space-y-4 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:p-8 md:pt-6',
          !embedded ? 'md:border' : ''
        )}
      >
        <StepProgressWithScoring
          items={
            quiz.stacks?.map((stack) => {
              return progressState?.[stack.id]
                ? {
                    status:
                      FEEDBACK_STATUS_PROGRESS_MAP[
                        progressState?.[stack.id].status ??
                          StackFeedbackStatus.Unanswered
                      ],
                    score: progressState?.[stack.id].score ?? null,
                  }
                : {
                    status: 'unanswered',
                  }
            }) || []
          }
          currentIx={currentIx}
          setCurrentIx={setQuizStep}
          resetLocalStorage={
            showResetLocalStorage
              ? () => {
                  resetPracticeQuizLocalStorage(quiz.id)
                  window.location.reload()
                }
              : undefined
          }
        />

        {previewOnly && (
          <PreviewMessage
            activityType={t('shared.generic.practiceQuiz')}
            name={quiz.name}
            displayName={quiz.displayName}
          />
        )}

        {currentIx === -1 && (
          <PracticeQuizOverview
            displayName={quiz.displayName}
            description={quiz.description ?? undefined}
            numOfStacks={quiz.numOfStacks ?? undefined}
            orderType={quiz.orderType}
            resetTimeDays={quiz.resetTimeDays ?? undefined}
            // previouslyAnswered={quiz.previouslyAnswered ?? undefined}
            // stacksWithQuestions={quiz.stacksWithQuestions ?? undefined}
            pointsMultiplier={quiz.pointsMultiplier}
            onStart={() => void requestQuizStart(0)}
            startLoading={semanticGateLoading}
            previewOnly={previewOnly}
          />
        )}

        {currentStack && (
          <ElementStack
            key={currentStack.id}
            parentId={quiz.id}
            courseId={quiz.course!.id}
            embedded={embedded}
            stack={currentStack}
            currentStep={currentIx + 1}
            totalSteps={quiz.stacks?.length ?? 0}
            setStepStatus={(value) => {
              setProgressState((prev) => {
                const next = { ...prev }
                next[currentStack.id] = value
                return next
              })
            }}
            handleNextElement={handleNextElement}
            withParticipant={
              !!dataParticipant?.self &&
              dataParticipant.self.role !== UserRole.TemporaryParticipant
            }
            onAllStacksCompletion={handleAllStacksCompletion}
            bookmarks={bookmarksData?.getBookmarksPracticeQuiz}
            previewOnly={previewOnly}
          />
        )}
      </div>
      {consentTargetIx !== null && capability && (
        <SemanticEvaluationConsentModal
          provider={capability.provider}
          disclosureVersion={capability.disclosureVersion}
          loading={consentResult.loading}
          error={!!consentResult.error}
          onAccept={() => void decideConsent(true)}
          onDecline={() => void decideConsent(false)}
        />
      )}
    </div>
  )
}

export default PracticeQuiz
