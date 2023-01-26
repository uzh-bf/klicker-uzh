import dayjs, { Dayjs } from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { useEffect, useState } from 'react'

dayjs.extend(duration)

interface CountdownProps {
  endTime: Dayjs
  onExpire?: () => void
}

function Countdown({ endTime, onExpire }: CountdownProps) {
  const [time, setTime] = useState<string>()

  useEffect(() => {
    const diffTime = endTime.unix() - dayjs().unix()

    let duration = dayjs.duration(diffTime * 1000, 'milliseconds')
    const interval = 1000
    const twoDP = (n: number) => (n > 9 ? n : '0' + n)

    const counter = setInterval(function () {
      duration = dayjs.duration(
        duration.asMilliseconds() - interval,
        'milliseconds'
      )

      if (duration.asMilliseconds() < 0) {
        clearInterval(counter)
        onExpire && onExpire()
        setTime('00m 00s')
        return
      } else if (duration.days() == 0 && duration.hours() == 0) {
        setTime(`${twoDP(duration.minutes())}m ${twoDP(duration.seconds())}s`)
      } else if (duration.days() == 0) {
        setTime(
          `${twoDP(duration.hours())}h ${twoDP(duration.minutes())}m ${twoDP(
            duration.seconds()
          )}s`
        )
      } else {
        setTime(
          `${duration.days() && duration.days() + 'd '}${twoDP(
            duration.hours()
          )}h ${twoDP(duration.minutes())}m ${twoDP(duration.seconds())}s`
        )
      }
    }, interval)

    return () => clearInterval(counter)
  }, [endTime, onExpire])
  return <span>{time}</span>
}

export default Countdown
