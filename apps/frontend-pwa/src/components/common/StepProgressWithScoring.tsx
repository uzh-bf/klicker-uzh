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
import { Button, StepItem, StepProgress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

type StackFeedbackStatus =
  | 'correct'
  | 'incorrect'
  | 'manuallyGraded'
  | 'partial'
  | 'unanswered'

const ICON_MAP: Record<StackFeedbackStatus, IconDefinition> = {
  manuallyGraded: faCheck,
  correct: faCheckDouble,
  incorrect: faX,
  partial: faCheck,
  unanswered: faInbox,
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
    <div className="flex w-full flex-row gap-1 md:gap-2">
      <StepProgress
        displayOffsetLeft={(items.length ?? 0) > 5 ? 3 : undefined}
        displayOffsetRight={(items.length ?? 0) > 5 ? 1 : undefined}
        value={currentIx === -1 ? undefined : currentIx}
        items={items}
        onItemClick={(ix: number) => setCurrentIx(ix)}
        data={{ cy: 'practice-quiz-progress' }}
        className={{ root: 'w-full' }}
        formatter={({ element, ix }) => (
          <div className="flex w-full flex-row justify-center px-0.5 md:px-2">
            <div className="flex flex-row items-center justify-between md:w-full">
              <div
                className={twMerge(
                  typeof element.score !== 'undefined' &&
                    element.score !== null &&
                    'hidden md:block'
                )}
              >
                {ix + 1}
              </div>

              {typeof element.score !== 'undefined' &&
                element.score !== null && (
                  <ProgressPoints
                    score={element.score as string | null}
                    status={element.status as string | null}
                  />
                )}
              <FontAwesomeIcon
                icon={ICON_MAP[element.status as StackFeedbackStatus]}
                className="hidden md:block"
              />
            </div>
          </div>
        )}
      />
      {resetLocalStorage && (
        <Button
          className={{ root: 'flex h-7 flex-row text-sm' }}
          onClick={() => {
            resetLocalStorage()
          }}
          data={{ cy: 'practice-quiz-reset' }}
        >
          <Button.Icon icon={faRepeat} className={{ root: 'mr-0 md:mr-2' }} />
          <Button.Label className={{ root: 'hidden w-max md:block' }}>
            {t('pwa.practiceQuiz.resetAnswers')}
          </Button.Label>
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
