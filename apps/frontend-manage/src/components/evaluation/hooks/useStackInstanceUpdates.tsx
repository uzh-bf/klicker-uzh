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
      Object.entries(stackInstanceMap).find(([stackIx, instances]) => {
        const instanceIndices = instances.map((instance) => instance.value)
        if (instanceIndices.includes(activeInstance)) {
          setActiveStack(Number(stackIx))
        }
      })
    }
  }, [activeInstance])
}

export default useStackInstanceUpdates
