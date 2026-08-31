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
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../common/PreviewMessage'
import StepProgressWithScoring from '../common/StepProgressWithScoring'
import ElementStack from './ElementStack'
import PracticeQuizOverview from './PracticeQuizOverview'
import type { EmbedQuizNavigationState } from './embed'

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
  focusedPresentation?: boolean
  previewOnly?: boolean
  hostNavigation?: boolean
  hostAdvanceRequest?: number
  onHostNavigationStateChange?: (state: EmbedQuizNavigationState) => void
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
  hostAdvanceRequest = 0,
  onHostNavigationStateChange,
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
          focusedEmbed
            ? 'w-full space-y-3 px-1 pt-2 pb-20 sm:px-2'
            : 'w-full space-y-4 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:p-8 md:pt-6',
          !embedded && 'md:border'
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
          setCurrentIx={setCurrentIx}
          readOnly={focusedEmbed}
          resetLocalStorage={
            showResetLocalStorage && !focusedEmbed
              ? () => {
                  resetPracticeQuizLocalStorage(quiz.id)
                  window.location.reload()
                }
              : undefined
          }
        />

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
            setCurrentIx={setCurrentIx}
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
            focusedPresentation={focusedEmbed}
            hostNavigation={hostNavigation}
            hostAdvanceRequest={hostAdvanceRequest}
            onHostNavigationStateChange={onHostNavigationStateChange}
          />
        )}
      </div>
    </div>
  )
}

export default PracticeQuiz
