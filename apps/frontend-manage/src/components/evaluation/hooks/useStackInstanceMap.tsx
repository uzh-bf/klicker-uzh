import { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

interface UseStackInstanceMapProps {
  stacks: StackEvaluation[]
}

function useStackInstanceMap({ stacks }: UseStackInstanceMapProps) {
  const stackInstanceMap = useMemo(() => {
    const { stackMap } = stacks.reduce<{
      instanceCount: number
      stackMap: Record<number, { label: string; value: number }[]>
    }>(
      (acc, stack, stackIx) => {
        acc.stackMap[stackIx] = stack.instances.map((instance, instanceIx) => ({
          label: instance.name,
          value: instanceIx + acc.instanceCount,
        }))

        acc.instanceCount += stack.instances.length
        return acc
      },
      { instanceCount: 0, stackMap: {} }
    )

    return stackMap
  }, [stacks])

  return stackInstanceMap
}

export default useStackInstanceMap
