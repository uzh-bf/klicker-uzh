import { useQuery } from '@apollo/client'
import {
  Course,
  GetBookmarksPracticeQuizDocument,
  PracticeQuiz as PracticeQuizType,
  SelfDocument,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../common/PreviewMessage'
import StepProgressWithScoring from '../common/StepProgressWithScoring'
import ElementStack from './ElementStack'
import PracticeQuizOverview from './PracticeQuizOverview'

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
  showResetLocalStorage?: boolean
  previewOnly?: boolean
}

function PracticeQuiz({
  quiz,
  currentIx,
  setCurrentIx,
  handleNextElement,
  showResetLocalStorage = false,
  previewOnly = false,
}: PracticeQuizProps) {
  const router = useRouter()
  const t = useTranslations()
  const currentStack = quiz.stacks?.[currentIx]
  const { data: dataParticipant } = useQuery(SelfDocument, {
    skip: previewOnly,
  })

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
    skip: previewOnly || !router.query.courseId || !dataParticipant?.self,
  })

  return (
    <div className="flex-1">
      <div
        className={twMerge(
          'w-full space-y-4 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:border md:p-8 md:pt-6'
        )}
      >
        <StepProgressWithScoring
          items={
            quiz.stacks?.map((stack) => {
              return progressState?.[stack.id] ?? { status: 'unanswered' }
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
            withParticipant={!!dataParticipant?.self}
            onAllStacksCompletion={() =>
              // TODO: re-introduce summary page for practice quiz
              router.push(`/`)
            }
            bookmarks={bookmarksData?.getBookmarksPracticeQuiz}
            previewOnly={previewOnly}
          />
        )}

        {/* {currentIx >= 0 && !currentStack && (
        <ElementSummary
          displayName={quiz.displayName}
          stacks={quiz.stacks || []}
        />
      )} */}
      </div>
    </div>
  )
}

export default PracticeQuiz
