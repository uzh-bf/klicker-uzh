import { useQuery } from '@apollo/client'
import {
  type Course,
  GetBookmarksPracticeQuizDocument,
  type PracticeQuiz as PracticeQuizType,
  SelfDocument,
  StackFeedbackStatus,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import { getIndividualEscapeRoomStages } from '@lib/escapeRoomStages'
import { useLocalStorage } from '@uidotdev/usehooks'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../common/PreviewMessage'
import StepProgressWithScoring from '../common/StepProgressWithScoring'
import {
  getEscapeRoomStageRules,
  getStageOutcome,
  hasBonusStage,
  isStageCleared,
  useEscapeRoom,
} from '../hooks/useEscapeRoom'
import ElementStack from './ElementStack'
import type { EmbedQuizNavigationState } from './embed'
import EscapeRoomOverlay from './EscapeRoomOverlay'
import PracticeQuizOverview from './PracticeQuizOverview'
import {
  findFirstUnansweredStack,
  type PracticeQuizProgressState,
} from './progress'

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
  const progressKey = `pq-${id}`
  const stackPrefix = `qi-${id}-`
  const localStorageKeys = Object.keys(localStorage)
  localStorageKeys.forEach((key) => {
    if (key === progressKey || key.startsWith(stackPrefix)) {
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
  focusedPresentation?: boolean
  previewOnly?: boolean
  hostNavigation?: boolean
  hostNavigationRequested?: boolean
  hostAdvanceRequest?: number
  onHostNavigationStateChange?: (state: EmbedQuizNavigationState) => void
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
  focusedPresentation = false,
  previewOnly = false,
  hostNavigation = false,
  hostNavigationRequested = false,
  hostAdvanceRequest = 0,
  onHostNavigationStateChange,
  refetch,
}: PracticeQuizProps) {
  const router = useRouter()
  const t = useTranslations()
  const focusedEmbed = embedded && focusedPresentation
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

  const [progressState, setProgressState] =
    useLocalStorage<PracticeQuizProgressState>(
      `pq-${quiz.id}`,
      quiz.stacks?.reduce<PracticeQuizProgressState>((acc, stack) => {
        acc[stack.id] = {
          status: StackFeedbackStatus.Unanswered,
          score: null,
        }
        return acc
      }, {})
    )

  const navigableUntilIx =
    embedded && hostNavigationRequested
      ? findFirstUnansweredStack(
          progressState,
          quiz.stacks?.map((stack) => stack.id) ?? []
        )
      : undefined

  const isEscapeRoom = !!quiz.escapeRoomConfig
  const escapeRoomHintPenalty = quiz.escapeRoomConfig?.hintPenalty ?? 120
  const escapeTotalStacks = quiz.numOfStacks ?? quiz.stacks?.length ?? 0
  // The bonus stage is the last stack; it is not required to complete the room
  const escapeHasBonus = hasBonusStage(quiz.escapeRoomConfig, escapeTotalStacks)
  const escapeRequiredStacks = escapeTotalStacks - (escapeHasBonus ? 1 : 0)
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

  const escapeStages = getIndividualEscapeRoomStages({
    stacks: quiz.stacks,
    totalStages: escapeTotalStacks,
    hasBonus: escapeHasBonus,
    stageOutcomes: attempt?.stageOutcomes,
  })

  // The bonus stage can be answered once after completion, while time remains
  const [bonusActive, setBonusActive] = useState(false)
  const bonusStack =
    escapeHasBonus && isCompleted && quiz.stacks?.length === escapeTotalStacks
      ? quiz.stacks[escapeTotalStacks - 1]
      : undefined
  const bonusOutcome = bonusStack
    ? getStageOutcome(attempt, bonusStack.id)?.outcome
    : undefined
  const bonusAvailable =
    !!bonusStack &&
    !bonusOutcome &&
    remainingSeconds !== null &&
    remainingSeconds > 0
  useEffect(() => {
    if (bonusActive && !bonusOutcome && remainingSeconds === 0) {
      setBonusActive(false)
    }
  }, [bonusActive, bonusOutcome, remainingSeconds])

  // Synchronize localStorage progress state with server's isCorrect fields if they differ
  // (and mark stacks cleared by reveal or skip, which have no correct response)
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
          } else if (
            !stack.isCorrect &&
            isStageCleared(attempt, stack.id) &&
            currentStatus !== StackFeedbackStatus.Partial
          ) {
            next[stack.id] = {
              status: StackFeedbackStatus.Partial,
              score: next[stack.id]?.score ?? null,
            }
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [isEscapeRoom, quiz.stacks, attempt, setProgressState])

  const handleSetCurrentIx = (ix: number) => {
    if (isEscapeRoom && ix >= 0) {
      const activeFirstUncleared =
        quiz.stacks?.findIndex(
          (stack) =>
            progressState?.[stack.id]?.status !== StackFeedbackStatus.Correct &&
            !isStageCleared(attempt, stack.id)
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
  // A revealed or skipped stack counts as cleared and is never retried; the
  // bonus stack is answered once and returns to the completion card.
  const [escapeRetryNonce, setEscapeRetryNonce] = useState(0)
  const handleEscapeAdvance = async (gradedStatus?: StackFeedbackStatus) => {
    if (!currentStack) return
    if (bonusActive && currentStack.id === bonusStack?.id) {
      if (refetch) await refetch()
      setBonusActive(false)
      return
    }
    const status = gradedStatus ?? progressState?.[currentStack.id]?.status
    if (
      status === StackFeedbackStatus.Correct ||
      isStageCleared(attempt, currentStack.id)
    ) {
      if (refetch) await refetch()
      if (currentIx + 1 < escapeRequiredStacks) {
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
          isCompleted={isCompleted && !bonusActive}
          isExpired={isExpired}
          remainingSeconds={remainingSeconds}
          mode="practiceQuiz"
          title={quiz.displayName}
          rules={
            quiz.escapeRoomConfig ?? {
              timeLimit: 3600,
              hintPenalty: escapeRoomHintPenalty,
            }
          }
          flush={!embedded}
          exit={
            embedded
              ? undefined
              : {
                  label: t('pwa.practiceQuiz.escapeRoomBackToCourse'),
                  onClick: () =>
                    router.push(
                      `/course/${quiz.course.id}/practiceQuizzes/overview`
                    ),
                }
          }
          onStart={startAttempt}
          loading={attemptLoading}
          attempt={attempt}
          stages={escapeStages}
          introText={quiz.escapeRoomConfig?.introText}
          bonus={
            bonusStack
              ? {
                  seconds: quiz.escapeRoomConfig?.bonusSeconds ?? 0,
                  available: bonusAvailable,
                  outcome: bonusOutcome,
                  onStart: () => {
                    setCurrentIx(escapeTotalStacks - 1)
                    setBonusActive(true)
                  },
                }
              : undefined
          }
        />
      )}
      <div
        className={twMerge(
          focusedEmbed
            ? 'w-full space-y-3 px-1 pt-2 pb-20 sm:px-2'
            : 'w-full space-y-4 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:p-8 md:pt-6',
          !embedded && 'md:border'
        )}
      >
        {!bonusActive && (
          <StepProgressWithScoring
            items={
              quiz.stacks
                ?.slice(0, isEscapeRoom ? escapeRequiredStacks : undefined)
                .map((stack) => {
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
            navigableUntilIx={navigableUntilIx}
            readOnly={hostNavigation}
            resetLocalStorage={
              // hidden in escape mode: local progress mirrors the server-side
              // attempt, so a local reset would only desync the participant view
              showResetLocalStorage && !hostNavigation && !isEscapeRoom
                ? () => {
                    resetPracticeQuizLocalStorage(quiz.id)
                    window.location.reload()
                  }
                : undefined
            }
          />
        )}

        {previewOnly && !focusedEmbed && (
          <PreviewMessage
            activityType={t('shared.generic.practiceQuiz')}
            name={quiz.name}
            displayName={quiz.displayName}
          />
        )}

        {currentIx === -1 && !focusedEmbed && (
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
            escapeStages={isEscapeRoom ? escapeStages : undefined}
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
              isEscapeRoom ? escapeRequiredStacks : (quiz.stacks?.length ?? 0)
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
            focusedPresentation={focusedEmbed}
            hostNavigation={hostNavigation}
            hostAdvanceRequest={hostAdvanceRequest}
            onHostNavigationStateChange={onHostNavigationStateChange}
            escapeRoom={
              isEscapeRoom
                ? {
                    activityType: 'practiceQuiz',
                    hintPenalty: escapeRoomHintPenalty,
                    onStateChanged: resolvedRefetch,
                    ...getEscapeRoomStageRules({
                      config: quiz.escapeRoomConfig!,
                      attempt,
                      stageKey: currentStack.id,
                      isBonusStage: currentStack.id === bonusStack?.id,
                    }),
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
