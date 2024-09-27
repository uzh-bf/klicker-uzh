import {
  faChevronLeft,
  faChevronRight,
  faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import { ActiveStackType } from '../ActivityEvaluation'
import useVisibleStacks from '../hooks/useVisibleStacks'

interface StackNavigationProps {
  stacks: StackEvaluation[]
  activeStack: ActiveStackType
  setActiveStack: (stack: ActiveStackType) => void
  setActiveInstance: (instance: number) => void
  stackInstanceMap: Record<number, { label: string; value: number }[]>
}

function StackNavigation({
  stacks,
  activeStack,
  setActiveStack,
  setActiveInstance,
  stackInstanceMap,
}: StackNavigationProps) {
  const width = 1
  const visibleStacks = useVisibleStacks({
    stacks,
    activeStack,
    width,
  })

  return (
    <div className="flex flex-row">
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
        data={{ cy: 'evaluate-previous-block' }}
      >
        <div
          className={twMerge(
            'hover:bg-primary-20 flex h-full flex-row items-center px-2',
            (stacks.length <= 2 * width + 1 ||
              (typeof activeStack === 'number' && activeStack - width <= 0)) &&
              'text-uzh-grey-80 cursor-not-allowed hover:bg-white'
          )}
        >
          <FontAwesomeIcon icon={faChevronLeft} size="lg" />
        </div>
      </Button>

      {visibleStacks.map((stack) => (
        <Button
          basic
          key={stack.value}
          onClick={() => {
            setActiveStack(stack.value)
            setActiveInstance(stackInstanceMap[stack.value][0].value)
          }}
          className={{
            root: twMerge(
              'hover:bg-primary-20 w-[7rem] border-b-2 border-transparent px-3 py-2 text-center',
              stack.value === activeStack && `border-primary-80 border-solid`
            ),
          }}
          data={{ cy: `evaluate-stack-${stack.value}` }}
        >
          <div className="flex w-full flex-row items-center justify-center gap-2">
            <FontAwesomeIcon size="xs" icon={faLayerGroup} />
            <div>{stack.label}</div>
          </div>
        </Button>
      ))}

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
        data={{ cy: 'evaluate-next-block' }}
      >
        <div
          className={twMerge(
            'hover:bg-primary-20 flex h-full flex-row items-center px-2',
            (stacks.length <= 2 * width + 1 ||
              (typeof activeStack === 'number' &&
                activeStack + width >= stacks.length - 1)) &&
              'text-uzh-grey-80 cursor-not-allowed hover:bg-white'
          )}
        >
          <FontAwesomeIcon icon={faChevronRight} size="lg" />
        </div>
      </Button>
    </div>
  )
}

export default StackNavigation
