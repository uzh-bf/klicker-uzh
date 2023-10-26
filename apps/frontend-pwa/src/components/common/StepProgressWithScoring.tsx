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

const ICON_MAP: Record<string, IconDefinition> = {
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
    <div className="flex flex-row w-full gap-1 md:gap-2">
      <StepProgress
        displayOffset={(items.length ?? 0) > 7 ? 3 : undefined}
        value={currentIx}
        items={items}
        onItemClick={(ix: number) => setCurrentIx(ix)}
        data={{ cy: 'learning-element-progress' }}
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
                  <div className="flex flex-row justify-between items-center md:w-full">
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
                      icon={ICON_MAP[element.status]}
                      className="hidden md:block"
                    />
                  </div>
                </div>
              ),
            }
          }

          if (element.status === 'correct') {
            return render({
              element,
              className: 'bg-green-600 bg-opacity-60 text-white',
            })
          }

          if (element.status === 'incorrect') {
            return render({
              element,
              className: 'bg-red-600 bg-opacity-60 text-white',
            })
          }

          if (element.status === 'partial') {
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
