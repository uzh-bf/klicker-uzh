import { faComment, faFaceSmile } from '@fortawesome/free-regular-svg-icons'
import {
  faChevronLeft,
  faChevronRight,
  faDoorOpen,
  faGamepad,
  faLayerGroup,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { ActiveStackType, ActivityEvaluationType } from '../ActivityEvaluation'
import useVisibleStacks from '../hooks/useVisibleStacks'

interface StackNavigationProps {
  stacks: StackEvaluation[]
  activeStack: ActiveStackType
  setActiveStack: (stack: ActiveStackType) => void
  setActiveInstance: (instance: number) => void
  stackInstanceMap: Record<number, { label: string; value: number }[]>
  type: ActivityEvaluationType
  leaderboardAvailable?: boolean
  feedbacksAvailable?: boolean
  escapeRoomAvailable?: boolean
}

const NavigationButton = ({
  icon,
  label,
  onClick,
  active,
  disabled,
  data,
  className,
}: {
  icon: IconDefinition
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  data?: { cy?: string; test?: string }
  className?: string
}) => (
  <Button
    basic
    onClick={onClick}
    disabled={disabled}
    className={{
      root: twMerge(
        'h-full rounded-none border-b-2 border-transparent pt-2',
        active && `border-primary-80 border-solid`,
        className || ''
      ),
    }}
    data={data}
  >
    <Button.Icon icon={icon} />
    <Button.Label>{label}</Button.Label>
  </Button>
)

function StackNavigation({
  stacks,
  activeStack,
  setActiveStack,
  setActiveInstance,
  stackInstanceMap,
  type,
  leaderboardAvailable = false,
  feedbacksAvailable = false,
  escapeRoomAvailable = false,
}: StackNavigationProps) {
  const t = useTranslations()
  const width = 1
  const visibleStacks = useVisibleStacks({
    stacks,
    activeStack,
    width,
    type,
  })

  return (
    <div className="flex h-11 flex-row">
      {visibleStacks.length > 0 && (
        <Button
          basic
          onClick={() => {
            const newActiveStack =
              typeof activeStack === 'number' ? Math.max(activeStack - 1, 0) : 0
            setActiveStack(newActiveStack)
            setActiveInstance(stackInstanceMap[newActiveStack][0].value)
          }}
          disabled={
            stacks.length <= 2 * width + 1 ||
            (typeof activeStack === 'number' && activeStack - width <= 0)
          }
          className={{ root: 'h-full px-1' }}
          data={{ cy: 'evaluate-previous-block' }}
        >
          <Button.Icon withoutLabel icon={faChevronLeft} />
        </Button>
      )}

      {visibleStacks.map((stack) => (
        <NavigationButton
          key={stack.value}
          onClick={() => {
            setActiveStack(stack.value)
            setActiveInstance(stackInstanceMap[stack.value][0].value)
          }}
          data={{ cy: `evaluate-stack-${stack.value}` }}
          className="w-28"
          active={stack.value === activeStack}
          icon={faLayerGroup}
          label={stack.label}
        />
      ))}

      {visibleStacks.length > 0 && (
        <Button
          basic
          onClick={() => {
            const newActiveStack =
              typeof activeStack === 'number'
                ? Math.min(activeStack + 1, stacks.length)
                : 0
            setActiveStack(newActiveStack)
            setActiveInstance(stackInstanceMap[newActiveStack][0].value)
          }}
          disabled={
            stacks.length <= 2 * width + 1 ||
            (typeof activeStack === 'number' &&
              activeStack + width >= stacks.length - 1)
          }
          className={{ root: 'h-full px-1' }}
          data={{ cy: 'evaluate-next-block' }}
        >
          <Button.Icon withoutLabel icon={faChevronRight} />
        </Button>
      )}

      {type === 'LiveQuiz' && leaderboardAvailable && (
        <NavigationButton
          onClick={() => {
            setActiveStack('leaderboard')
          }}
          data={{ cy: 'evaluation-leaderboard' }}
          active={activeStack === 'leaderboard'}
          icon={faGamepad}
          label={t('shared.generic.leaderboard')}
        />
      )}
      {type === 'LiveQuiz' && feedbacksAvailable && (
        <>
          <NavigationButton
            onClick={() => {
              setActiveStack('feedbacks')
            }}
            data={{ cy: 'evaluation-feedbacks' }}
            active={activeStack === 'feedbacks'}
            icon={faComment}
            label={t('shared.generic.feedbacks')}
          />
          <NavigationButton
            onClick={() => {
              setActiveStack('confusion')
            }}
            data={{ cy: 'evaluation-confusion' }}
            active={activeStack === 'confusion'}
            icon={faFaceSmile}
            label={t('manage.evaluation.confusion')}
          />
        </>
      )}
      {escapeRoomAvailable && (
        <NavigationButton
          onClick={() => {
            setActiveStack('escapeRoom')
          }}
          data={{ cy: 'evaluation-escape-room' }}
          active={activeStack === 'escapeRoom'}
          icon={faDoorOpen}
          label={t('manage.evaluation.escapeRoomTab')}
        />
      )}
    </div>
  )
}

export default StackNavigation
