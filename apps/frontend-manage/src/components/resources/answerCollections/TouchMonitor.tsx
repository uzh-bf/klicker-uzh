import { Dispatch, SetStateAction, useEffect } from 'react'

function TouchMonitor({
  touched,
  stateValue,
  setState,
}: {
  touched: boolean
  stateValue: boolean
  setState: Dispatch<SetStateAction<boolean>>
}) {
  useEffect(() => {
    if (typeof touched !== 'undefined' && stateValue !== touched) {
      setState(touched)
    }
  }, [setState, stateValue, touched])
  return null
}

export default TouchMonitor
