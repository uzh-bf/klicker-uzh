import dayjs from 'dayjs'
import React from 'react'
import { CountdownCircleTimer } from 'react-countdown-circle-timer'

interface CountdownProps {
  isCompleted?: boolean
  expiresAt?: any
  countdownDuration: number
  className?: string
  onExpire: () => void
}

function Countdown({
  isCompleted,
  countdownDuration,
  expiresAt,
  className,
  onExpire,
}: CountdownProps): React.ReactElement {
  const remaining = expiresAt ? dayjs(expiresAt).diff(dayjs(), 'second') : 1000


  return (
    <div className={className}>
      <CountdownCircleTimer
        isPlaying
        duration={remaining > countdownDuration ? countdownDuration : remaining}
        colors={['#00A321', '#00A321', '#F7B801', '#A30000']}
        colorsTime={[countdownDuration, countdownDuration / 2 >> 0, countdownDuration / 4 >> 0, 0]}
        size={45}
        strokeWidth={7}
        onComplete={onExpire}
      >
        {({ remainingTime }: any) => {
          return remainingTime
        }}
      </CountdownCircleTimer>
    </div>
  )
}

Countdown.defaultProps = {
  countdownStepSize: 1000,
  isCompleted: false,
}

export default Countdown
