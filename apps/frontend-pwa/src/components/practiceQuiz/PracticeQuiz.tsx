import { useLocalStorage } from '@uidotdev/usehooks'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import { trpc, type RouterOutputs } from '../../lib/trpc'
import PreviewMessage from '../common/PreviewMessage'
import StepProgressWithScoring from '../common/StepProgressWithScoring'
import ElementStack from './ElementStack'
import PracticeQuizOverview from './PracticeQuizOverview'

const PARTICIPANT_ROLE = 'PARTICIPANT'
const TEMPORARY_PARTICIPANT_ROLE = 'TEMPORARY_PARTICIPANT'
const STACK_FEEDBACK_STATUS = {
  Correct: 'correct',
  Incorrect: 'incorrect',
  ManuallyGraded: 'manuallyGraded',
  Partial: 'partial',
  Unanswered: 'unanswered',
} as const

type StackFeedbackStatus =
  (typeof STACK_FEEDBACK_STATUS)[keyof typeof STACK_FEEDBACK_STATUS]

type PracticeQuizType = NonNullable<
  RouterOutputs['participant']['practiceQuiz']['practiceQuiz']
>
type ElementStackProp = Parameters<typeof ElementStack>[0]['stack']
type PracticeQuizStack = PracticeQuizType['stacks'][number] | ElementStackProp
type PracticeQuizRendererQuiz = Pick<
  PracticeQuizType,
  | 'description'
  | 'displayName'
  | 'id'
  | 'name'
  | 'numOfStacks'
  | 'orderType'
  | 'pointsMultiplier'
  | 'resetTimeDays'
> & {
  course: Pick<PracticeQuizType['course'], 'id'>
  stacks?: PracticeQuizStack[] | null
}

export const FEEDBACK_STATUS_PROGRESS_MAP: Record<
  StackFeedbackStatus,
  'correct' | 'unanswered' | 'incorrect' | 'partial' | undefined
> = {
  [STACK_FEEDBACK_STATUS.Correct]: 'correct',
  [STACK_FEEDBACK_STATUS.Incorrect]: 'incorrect',
  [STACK_FEEDBACK_STATUS.Partial]: 'partial',
  [STACK_FEEDBACK_STATUS.Unanswered]: 'unanswered',
  [STACK_FEEDBACK_STATUS.ManuallyGraded]: 'unanswered',
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
  quiz: PracticeQuizRendererQuiz
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
  const courseId =
    typeof router.query.courseId === 'string' ? router.query.courseId : ''
  const { data: dataParticipant } = trpc.participant.self.useQuery(undefined, {
    enabled: !previewOnly,
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

  const practiceQuizBookmarksInput = {
    courseId,
    quizId: quiz.id === 'bookmarks' ? undefined : quiz.id,
  }
  const { data: bookmarksData } =
    trpc.participant.practiceQuizBookmarks.useQuery(
      practiceQuizBookmarksInput,
      {
        enabled:
          !previewOnly &&
          courseId !== '' &&
          !!dataParticipant?.self &&
          dataParticipant?.self.role === PARTICIPANT_ROLE,
      }
    )

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
                          STACK_FEEDBACK_STATUS.Unanswered
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
            stack={currentStack as ElementStackProp}
            currentStep={currentIx + 1}
            totalSteps={quiz.stacks?.length ?? 0}
            setStepStatus={(value) => {
              setProgressState((prev) => {
                const next = { ...prev }
                next[currentStack.id] = {
                  status: value.status as StackFeedbackStatus,
                  score: value.score,
                }
                return next
              })
            }}
            handleNextElement={handleNextElement}
            withParticipant={
              !!dataParticipant?.self &&
              dataParticipant.self.role !== TEMPORARY_PARTICIPANT_ROLE
            }
            onAllStacksCompletion={handleAllStacksCompletion}
            bookmarks={bookmarksData}
            previewOnly={previewOnly}
          />
        )}
      </div>
    </div>
  )
}

export default PracticeQuiz
