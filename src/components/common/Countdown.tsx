import React, { useEffect, useState } from 'react'
import { Icon } from 'semantic-ui-react'

interface Props {
  isActive?: boolean
  isCompleted?: boolean
  countdownDuration: number
  countdownStepSize?: number
  children?: Function
}

function Countdown({
  isCompleted,
  isActive,
  countdownDuration,
  countdownStepSize,
  children,
}: Props): React.ReactElement {
  const [secondsRemaining, setSecondsRemaining] = useState(countdownDuration)

  useEffect((): any => {
    if (isActive) {
      const interval = setInterval((): void => {
        setSecondsRemaining((prev): number => {
          const newValue = prev - countdownStepSize / 1000
          if (newValue <= 0) {
            clearInterval(interval)
            return 0
          }
          return newValue
        })
      }, countdownStepSize)
      return (): void => clearInterval(interval)
    }
    return () => null
  }, [isActive, countdownStepSize, countdownDuration])

  if (children) {
    return children(secondsRemaining)
  }

  return (
    <>
      <Icon name="clock" />
      {isCompleted ? '0' : secondsRemaining}s
    </>
  )
}

Countdown.defaultProps = {
  countdownStepSize: 1000,
  isActive: true,
  isCompleted: false,
}

export default Countdown
