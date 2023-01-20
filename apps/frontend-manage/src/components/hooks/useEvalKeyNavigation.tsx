import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { useCallback, useEffect } from 'react'

interface useEvalKeyNavigationProps {
  selectedInstanceIndex: number
  instanceResults: InstanceResult[]
  setSelectedInstance: (id: string) => void
  setSelectedBlock: (blockIx: number) => void
}

function useEvalKeyNavigation({
  selectedInstanceIndex,
  instanceResults,
  setSelectedInstance,
  setSelectedBlock,
}: useEvalKeyNavigationProps) {
  const handleUserKeyPress = useCallback(
    (event: KeyboardEvent) => {
      const { key } = event
      if (key === 'ArrowLeft') {
        if (selectedInstanceIndex > 0) {
          setSelectedInstance(instanceResults[selectedInstanceIndex - 1].id)
          setSelectedBlock(instanceResults[selectedInstanceIndex - 1].blockIx)
        }
      } else if (key === 'ArrowRight') {
        if (selectedInstanceIndex < instanceResults.length - 1) {
          setSelectedInstance(instanceResults[selectedInstanceIndex + 1].id)
          setSelectedBlock(instanceResults[selectedInstanceIndex + 1].blockIx)
        }
      }
    },
    [
      instanceResults,
      selectedInstanceIndex,
      setSelectedBlock,
      setSelectedInstance,
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleUserKeyPress)
    return () => {
      window.removeEventListener('keydown', handleUserKeyPress)
    }
  }, [handleUserKeyPress])
}

export default useEvalKeyNavigation
