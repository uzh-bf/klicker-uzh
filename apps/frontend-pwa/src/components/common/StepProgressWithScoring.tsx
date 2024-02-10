import {
  IconDefinition,
  faBarsStaggered,
  faCheck,
  faCheckDouble,
  faInbox,
  faRepeat,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { StackFeedbackStatus } from '@klicker-uzh/graphql/dist/ops'
import { Button, StepItem, StepProgress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

const ICON_MAP: Record<StackFeedbackStatus, IconDefinition> = {
  [StackFeedbackStatus.ManuallyGraded]: faCheck,
  [StackFeedbackStatus.Correct]: faCheckDouble,
  [StackFeedbackStatus.Incorrect]: faX,
  [StackFeedbackStatus.Partial]: faCheck,
  [StackFeedbackStatus.Unanswered]: faInbox,
}

interface StepProgressWithScoringProps {
  items: StepItem[]
  currentIx: number
  setCurrentIx: (ix: number) => void
  resetLocalStorage?: () => void
}

function StepProgressWithScoring({
  items,
  currentIx,
  setCurrentIx,
  resetLocalStorage,
}: StepProgressWithScoringProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-row w-full gap-1 md:gap-2">
      <StepProgress
        displayOffsetLeft={(items.length ?? 0) > 5 ? 3 : undefined}
        displayOffsetRight={(items.length ?? 0) > 5 ? 1 : undefined}
        value={currentIx === -1 ? undefined : currentIx}
        items={items}
        onItemClick={(ix: number) => setCurrentIx(ix)}
        data={{ cy: 'practice-quiz-progress' }}
        className={{ root: 'w-full' }}
        formatter={({ element, ix }) => {
          function render({
            className,
            element,
          }: {
            className: string
            element: StepItem
          }) {
            return {
              className,
              element: (
                <div className="flex flex-row justify-center w-full px-0.5 md:px-2">
                  <div className="flex flex-row items-center justify-between md:w-full">
                    <div
                      className={twMerge(element.score && 'hidden md:block')}
                    >
                      {ix + 1}
                    </div>

                    {element.score && (
                      <ProgressPoints
                        score={element.score}
                        status={element.status}
                      />
                    )}
                    <FontAwesomeIcon
                      icon={ICON_MAP[element.status as StackFeedbackStatus]}
                      className="hidden md:block"
                    />
                  </div>
                </div>
              ),
            }
          }

          if (element.status === StackFeedbackStatus.Correct) {
            return render({
              element,
              className: 'bg-green-600 bg-opacity-60 text-white',
            })
          }

          if (element.status === StackFeedbackStatus.Incorrect) {
            return render({
              element,
              className: 'bg-red-600 bg-opacity-60 text-white',
            })
          }

          if (element.status === StackFeedbackStatus.Partial) {
            return render({
              element,
              className: 'bg-uzh-red-100 bg-opacity-60 text-white',
            })
          }

          return render({
            element,
            className: '',
          })
        }}
      />
      {resetLocalStorage && (
        <Button
          className={{ root: 'text-sm h-7 flex flex-row' }}
          onClick={() => {
            resetLocalStorage()
          }}
          data={{ cy: 'practice-quiz-reset' }}
        >
          <FontAwesomeIcon icon={faRepeat} />
          <div className="hidden w-max md:block">
            {t('pwa.practiceQuiz.resetAnswers')}
          </div>
        </Button>
      )}
    </div>
  )
}

interface ProgressPointsProps {
  score?: string | null
  status?: string | null
}

const ProgressPoints = ({ score, status }: ProgressPointsProps) => {
  if (typeof score !== 'undefined' && score !== null) {
    return <div>{score}p</div>
  }

  if (status !== 'unanswered') {
    return <FontAwesomeIcon icon={faBarsStaggered} />
  }

  return null
}

export default StepProgressWithScoring
