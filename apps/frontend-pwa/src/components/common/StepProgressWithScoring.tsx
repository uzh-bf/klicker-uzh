import {
  IconDefinition,
  faBarsStaggered,
  faCheck,
  faCheckDouble,
  faInbox,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { StepItem, StepProgress } from '@uzh-bf/design-system'

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
}

function StepProgressWithScoring({
  items,
  currentIx,
  setCurrentIx,
}: StepProgressWithScoringProps) {
  return (
    <StepProgress
      displayOffset={(items.length ?? 0) > 15 ? 3 : undefined}
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
              <div className="flex w-full flex-row items-center justify-between px-2">
                <div>{ix + 1}</div>

                {typeof element.score !== 'undefined' &&
                element.score !== null ? (
                  <div>{element.score}p</div>
                ) : element.status !== 'unanswered' ? (
                  <FontAwesomeIcon icon={faBarsStaggered} />
                ) : null}

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

export default StepProgressWithScoring
