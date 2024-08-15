import { useEffect, useState } from 'react'

function useComponentVisibleCounter() {
  const [inFocus, setInFocus] = useState(true)
  const [timeSpent, setTimeSpent] = useState(0)

  // update time spent on stack if the stack is visible
  useEffect(() => {
    const timer = setInterval(() => {
      if (inFocus) {
        setTimeSpent((current) => current + 1)
      } else {
        clearInterval(timer)
      }
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [inFocus])

  // track if the current tab is in focus or not
  useEffect(() => {
    const handleBlur = () => setInFocus(false)
    const handleFocus = () => setInFocus(true)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return timeSpent
}

export default useComponentVisibleCounter
