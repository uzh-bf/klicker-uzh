import { MutableRefObject, useEffect, useState } from 'react'

function useComponentVisibleCounter({
  timeRef,
}: {
  timeRef: MutableRefObject<number>
}) {
  const [inFocus, setInFocus] = useState(true)

  // update time spent on stack if the stack is visible
  useEffect(() => {
    const timer = setInterval(() => {
      if (inFocus) {
        timeRef.current = timeRef.current + 1
      } else {
        clearInterval(timer)
      }
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [inFocus, timeRef])

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
}

export default useComponentVisibleCounter
