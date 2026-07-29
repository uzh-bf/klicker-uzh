import { useQuery } from '@apollo/client'
import {
  Course,
  GetBookmarksPracticeQuizDocument,
  PracticeQuiz as PracticeQuizType,
  SelfDocument,
  StackFeedbackStatus,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../common/PreviewMessage'
import StepProgressWithScoring from '../common/StepProgressWithScoring'
import { useEscapeRoom } from '../hooks/useEscapeRoom'
import ElementStack from './ElementStack'
import EscapeRoomOverlay from './EscapeRoomOverlay'
import PracticeQuizOverview from './PracticeQuizOverview'

const noopRefetch = async () => undefined

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
  refetch?: () => Promise<unknown>
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
  refetch,
}: PracticeQuizProps) {
  const router = useRouter()
  const t = useTranslations()
  const currentStack = quiz.stacks?.[currentIx]
  const { data: dataParticipant } = useQuery(SelfDocument, {
    skip: previewOnly,
  })

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

  const isEscapeRoom = !!quiz.escapeRoomConfig
  const escapeRoomHintPenalty = quiz.escapeRoomConfig?.hintPenalty ?? 120
  const resolvedRefetch = refetch ?? noopRefetch
  const {
    attempt,
    isStarted,
    isCompleted,
    isExpired,
    remainingSeconds,
    startAttempt,
    loading: attemptLoading,
  } = useEscapeRoom({
    activity: quiz,
    activityType: 'practiceQuiz',
    refetch: resolvedRefetch,
  })

  // Synchronize localStorage progress state with server's isCorrect fields if they differ
  useEffect(() => {
    if (isEscapeRoom && quiz.stacks) {
      setProgressState((prev) => {
        let changed = false
        const next = { ...prev }
        for (const stack of quiz.stacks!) {
          const currentStatus = next[stack.id]?.status
          if (
            stack.isCorrect &&
            currentStatus !== StackFeedbackStatus.Correct
          ) {
            next[stack.id] = {
              status: StackFeedbackStatus.Correct,
              score: next[stack.id]?.score ?? null,
            }
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [isEscapeRoom, quiz.stacks, setProgressState])

  const handleSetCurrentIx = (ix: number) => {
    if (isEscapeRoom && ix >= 0) {
      const activeFirstUncleared =
        quiz.stacks?.findIndex(
          (stack) =>
            progressState?.[stack.id]?.status !== StackFeedbackStatus.Correct
        ) ?? 0

      if (activeFirstUncleared !== -1 && ix > activeFirstUncleared) {
        setCurrentIx(activeFirstUncleared)
        return
      }
    }
    setCurrentIx(ix)
  }

  // Escape mode masks locked stacks server-side, so quiz.stacks only contains
  // cleared stacks plus the first uncleared one — never the full quiz. The
  // regular advance logic (currentStep === totalSteps → completion) would
  // treat every stack as the last one and boot the participant back home.
  // Instead: on a correct answer refetch (unmasking the next stack) and
  // advance; on an incorrect answer wipe the stored evaluation and remount the
  // stack so it can be retried once the lockout elapses. Completion is
  // server-driven (attempt status flips → overlay takes over).
  const [escapeRetryNonce, setEscapeRetryNonce] = useState(0)
  const escapeTotalStacks = quiz.numOfStacks ?? quiz.stacks?.length ?? 0
  const handleEscapeAdvance = async (gradedStatus?: StackFeedbackStatus) => {
    if (!currentStack) return
    const status = gradedStatus ?? progressState?.[currentStack.id]?.status
    if (status === StackFeedbackStatus.Correct) {
      if (refetch) await refetch()
      if (currentIx + 1 < escapeTotalStacks) {
        handleNextElement()
      }
    } else {
      localStorage.removeItem(`qi-${quiz.id}-${currentStack.id}`)
      setEscapeRetryNonce((nonce) => nonce + 1)
      refetch?.()
    }
  }

  const handleStartQuiz = async () => {
    if (isEscapeRoom) {
      if (!isStarted) {
        await startAttempt()
      }
      // Trigger a direct refetch to make sure isCorrect fields are up-to-date
      if (refetch) {
        await refetch()
      }
      handleSetCurrentIx(0)
    } else {
      setCurrentIx(0)
    }
  }

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
      {isEscapeRoom && !previewOnly && (
        <EscapeRoomOverlay
          isStarted={isStarted}
          isCompleted={isCompleted}
          isExpired={isExpired}
          remainingSeconds={remainingSeconds}
          timeLimit={quiz.escapeRoomConfig?.timeLimit ?? 3600}
          hintPenalty={escapeRoomHintPenalty}
          onStart={startAttempt}
          loading={attemptLoading}
          attempt={attempt}
          clearedStacks={
            quiz.stacks?.filter(
              (stack) =>
                progressState?.[stack.id]?.status ===
                StackFeedbackStatus.Correct
            ).length ?? 0
          }
          totalStacks={quiz.numOfStacks ?? quiz.stacks?.length ?? 0}
          introText={quiz.escapeRoomConfig?.introText}
        />
      )}
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
          setCurrentIx={handleSetCurrentIx}
          resetLocalStorage={
            // hidden in escape mode: local progress mirrors the server-side
            // attempt, so a local reset would only desync the participant view
            showResetLocalStorage && !isEscapeRoom
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
            setCurrentIx={handleStartQuiz}
            previewOnly={previewOnly}
            isEscapeRoom={isEscapeRoom}
          />
        )}

        {currentStack && (
          <ElementStack
            key={
              isEscapeRoom
                ? `${currentStack.id}-${escapeRetryNonce}`
                : currentStack.id
            }
            parentId={quiz.id}
            courseId={quiz.course!.id}
            embedded={embedded}
            stack={currentStack}
            currentStep={currentIx + 1}
            totalSteps={
              isEscapeRoom ? escapeTotalStacks : (quiz.stacks?.length ?? 0)
            }
            setStepStatus={(value) => {
              setProgressState((prev) => {
                const next = { ...prev }
                next[currentStack.id] = value
                return next
              })
            }}
            handleNextElement={
              isEscapeRoom ? handleEscapeAdvance : handleNextElement
            }
            withParticipant={
              !!dataParticipant?.self &&
              dataParticipant.self.role !== UserRole.TemporaryParticipant
            }
            onAllStacksCompletion={
              isEscapeRoom ? handleEscapeAdvance : handleAllStacksCompletion
            }
            bookmarks={bookmarksData?.getBookmarksPracticeQuiz}
            previewOnly={previewOnly}
            escapeRoom={
              isEscapeRoom
                ? {
                    activityType: 'practiceQuiz',
                    hintPenalty: escapeRoomHintPenalty,
                    onStateChanged: resolvedRefetch,
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  )
}

export default PracticeQuiz
