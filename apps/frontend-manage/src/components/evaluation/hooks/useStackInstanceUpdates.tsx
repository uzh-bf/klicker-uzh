import { useEffect } from 'react'

interface UseStackInstanceUpdatesProps {
  activeInstance: number
  stackInstanceMap: Record<number, { label: string; value: number }[]>
  setActiveStack: (stack: number) => void
}

function useStackInstanceUpdates({
  activeInstance,
  stackInstanceMap,
  setActiveStack,
}: UseStackInstanceUpdatesProps) {
  useEffect(() => {
    if (activeInstance !== -1) {
      for (const [stackIx, instances] of Object.entries(stackInstanceMap)) {
        const instanceIndices = instances.map((instance) => instance.value)
        if (instanceIndices.includes(activeInstance)) {
          setActiveStack(Number(stackIx))
          break
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInstance])
}

export default useStackInstanceUpdates
