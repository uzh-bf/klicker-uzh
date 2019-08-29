import React, { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Icon } from 'semantic-ui-react'

interface Props {
  isActive?: boolean
  isCompleted?: boolean
  countdownEnd?: any
  countdownDuration?: number
  countdownStepSize?: number
  children?: Function
}

function Countdown({
  isCompleted,
  isActive,
  countdownDuration,
  countdownEnd,
  countdownStepSize,
  children,
}: Props): React.ReactElement {
  const [secondsRemaining, setSecondsRemaining] = useState(countdownDuration)

  useEffect((): any => {
    let interval
    if (!isCompleted && isActive) {
      interval = setInterval((): void => {
        setSecondsRemaining((prev): number => {
          const newValue = prev - countdownStepSize / 1000
          if (newValue <= 0) {
            clearInterval(interval)
            return 0
          }
          return newValue
        })
      }, countdownStepSize)
    }
    return (): void => clearInterval(interval)
  }, [isCompleted, isActive, countdownStepSize])

  if (children) {
    return children(secondsRemaining)
  }

  if (isCompleted || !isActive) {
    return (
      <>
        <Icon name="clock outline" />
        {countdownDuration}s
      </>
    )
  }

  if (countdownEnd) {
    const remaining = dayjs(countdownEnd).diff(dayjs(), 'second')
    if (remaining > 0) {
      return (
        <>
          <Icon name="clock" />
          {remaining}s
        </>
      )
    }

    return (
      <>
        <Icon name="clock" />
        0s
      </>
    )
  }

  return (
    <>
      <Icon name="clock" />
      {secondsRemaining}s
    </>
  )
}

Countdown.defaultProps = {
  countdownStepSize: 1000,
  isActive: true,
  isCompleted: false,
}

export default Countdown
