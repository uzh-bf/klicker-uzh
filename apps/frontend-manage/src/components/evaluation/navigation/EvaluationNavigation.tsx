import { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ActiveStackType } from '../ActivityEvaluation'
import InstanceNavigation from './InstanceNavigation'
import StackNavigation from './StackNavigation'

interface EvaluationNavigationProps {
  stacks: StackEvaluation[]
  stackInstanceMap: Record<number, { label: string; value: number }[]>
  activeStack: ActiveStackType
  setActiveStack: (stack: ActiveStackType) => void
  activeInstance: number
  setActiveInstance: (instance: number) => void
  numOfInstances: number
}

function EvaluationNavigation({
  stacks,
  stackInstanceMap,
  activeStack,
  setActiveStack,
  activeInstance,
  setActiveInstance,
  numOfInstances,
}: EvaluationNavigationProps) {
  return (
    <div className="flex w-full flex-row justify-between border-b-2 border-solid bg-white px-3 print:hidden">
      {typeof activeStack === 'number' && (
        <InstanceNavigation
          stack={stacks[activeStack]}
          activeInstance={activeInstance ?? 0}
          setActiveInstance={setActiveInstance}
          numOfInstances={numOfInstances}
          instanceSelection={stackInstanceMap[activeStack]}
        />
      )}
      <StackNavigation
        stacks={stacks}
        activeStack={activeStack}
        setActiveStack={setActiveStack}
        stackInstanceMap={stackInstanceMap}
        setActiveInstance={setActiveInstance}
      />
    </div>
  )
}

export default EvaluationNavigation
