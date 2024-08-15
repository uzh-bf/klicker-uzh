import { useEffect, useState } from 'react'

function useComponentVisibleCounter() {
  const [inFocus, setInFocus] = useState(true)
  const [timeSpent, setTimeSpent] = useState(0)

  // update time spent on stack if the stack is visible
  useEffect(() => {
    const timer = setInterval(() => {
      if (inFocus) {
        setTimeSpent((current) => current + 1)
      }
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [timeSpent, inFocus])

  // track if the current tab is in focus or not
  window.onblur = () => {
    setInFocus(false)
  }
  window.onfocus = () => {
    setInFocus(true)
  }

  return timeSpent
}

export default useComponentVisibleCounter
