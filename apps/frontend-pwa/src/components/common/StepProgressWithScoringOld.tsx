import {
  IconDefinition,
  faBarsStaggered,
  faCheck,
  faCheckDouble,
  faInbox,
  faUserPen,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { StepItem, StepProgress } from '@uzh-bf/design-system'

const ICON_MAP: Record<string, IconDefinition> = {
  correct: faCheckDouble,
  incorrect: faX,
  partial: faCheck,
  manuallyGraded: faCheck,
  unanswered: faInbox,
}

interface StepProgressWithScoringProps {
  items: StepItem[]
  currentIx: number
  setCurrentIx: (ix: number) => void
}

function StepProgressWithScoring({
  items,
  currentIx,
  setCurrentIx,
}: StepProgressWithScoringProps) {
  return (
    <StepProgress
      displayOffsetLeft={(items.length ?? 0) > 7 ? 3 : undefined}
      displayOffsetRight={(items.length ?? 0) > 7 ? 3 : undefined}
      value={currentIx}
      items={items}
      onItemClick={(ix: number) => setCurrentIx(ix)}
      data={{ cy: 'learning-element-progress' }}
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
              <div className="flex flex-row items-center justify-between w-full px-2">
                <div>{ix + 1}</div>

                <ProgressPoints score={element.score} status={element.status} />
                <FontAwesomeIcon icon={ICON_MAP[element.status]} />
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

  if (status === 'manuallyGraded') {
    return <FontAwesomeIcon icon={faUserPen} />
  }

  if (status !== 'unanswered') {
    return <FontAwesomeIcon icon={faBarsStaggered} />
  }

  return null
}

export default StepProgressWithScoring
