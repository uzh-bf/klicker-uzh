import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import { Icon } from 'semantic-ui-react'

interface Props {
  isActive?: boolean
  isCompleted?: boolean
  countdownEnd?: any
  countdownDuration?: number
  countdownStepSize?: number
  children?: any
  circularDisplay?: boolean
}

function Countdown({
  isCompleted,
  isActive,
  countdownDuration,
  countdownEnd,
  countdownStepSize,
  children,
  circularDisplay,
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
      if (circularDisplay) {
        return (
          <>
            <CircularProgressbar
              maxValue={countdownDuration}
              minValue={0}
              strokeWidth={20}
              styles={buildStyles({
                pathColor: 'darkorange',
                strokeLinecap: 'butt',
                textColor: 'darkorange',
                textSize: '30px',
              })}
              text={`${remaining}`}
              value={countdownDuration - remaining}
            />
          </>
        )
      }

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
  circularDisplay: false,
}

export default Countdown
