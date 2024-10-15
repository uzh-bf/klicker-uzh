import { useArrowNavigation } from '@uzh-bf/design-system'

interface UseInstanceArrowNavigationProps {
  activeInstance: number
  setActiveInstance: (instance: number) => void
  numOfInstances: number
}

function useIntanceArrowNavigation({
  activeInstance,
  setActiveInstance,
  numOfInstances,
}: UseInstanceArrowNavigationProps) {
  useArrowNavigation({
    onArrowLeft: () => {
      if (activeInstance > 0 && activeInstance !== -1) {
        setActiveInstance(activeInstance - 1)
      }
    },
    onArrowRight: () => {
      if (activeInstance < numOfInstances - 1 && activeInstance !== -1) {
        setActiveInstance(activeInstance + 1)
      }
    },
  })
}

export default useIntanceArrowNavigation
