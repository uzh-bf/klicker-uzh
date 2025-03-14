import { useEffect } from 'react'

function TouchMonitor({
  touched,
  onTouch,
}: {
  touched: boolean
  onTouch: () => void
}) {
  useEffect(() => {
    if (touched) {
      onTouch()
    }
  }, [touched, onTouch])

  return null
}

export default TouchMonitor
