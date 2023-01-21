import { useCallback, useEffect } from 'react'

interface useArrowNavigationProps {
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
}

function useArrowNavigation({
  onArrowLeft,
  onArrowRight,
  onArrowUp,
  onArrowDown,
}: useArrowNavigationProps) {
  const handleUserKeyPress = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault()
      const { key } = event
      if (key === 'ArrowLeft' && onArrowLeft) {
        onArrowLeft()
      } else if (key === 'ArrowRight' && onArrowRight) {
        onArrowRight()
      } else if (key === 'ArrowUp' && onArrowUp) {
        onArrowUp()
      } else if (key === 'ArrowDown' && onArrowDown) {
        onArrowDown()
      }
    },
    [onArrowLeft, onArrowRight, onArrowUp, onArrowDown]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleUserKeyPress)
    return () => {
      window.removeEventListener('keydown', handleUserKeyPress)
    }
  }, [handleUserKeyPress])
}

export default useArrowNavigation
