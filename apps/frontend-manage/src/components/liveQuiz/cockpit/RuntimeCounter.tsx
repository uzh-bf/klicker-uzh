import { faClock, faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import dayjs from 'dayjs'
import durationPlugin from 'dayjs/plugin/duration'
import { useEffect, useState } from 'react'

dayjs.extend(durationPlugin)

const calculateRuntime = ({ startedAt }: { startedAt?: string }) => {
  const start = dayjs(startedAt)
  const duration = dayjs.duration(dayjs().diff(start))

  const days = duration.days()
  const hours = `0${duration.hours()}`.slice(-2)
  const minutes = `0${duration.minutes()}`.slice(-2)
  const seconds = `0${duration.seconds()}`.slice(-2)

  if (days > 0) {
    return `${days}d ${hours}:${minutes}:${seconds}`
  }
  return `${hours}:${minutes}:${seconds}`
}

function RuntimeCounter({ startedAt }: { startedAt?: string }) {
  const [runtime, setRuntime] = useState(calculateRuntime({ startedAt }))
  const startingTime = runtime.includes('d')
    ? dayjs(startedAt).format('DD.MM HH:mm:ss')
    : dayjs(startedAt).format('HH:mm:ss')

  useEffect(() => {
    const currentRuntime = setInterval(() => {
      setRuntime(calculateRuntime({ startedAt }))
    }, 1000)
    return () => clearInterval(currentRuntime)
  }, [startedAt])

  return (
    <>
      <div>
        <FontAwesomeIcon icon={faClock} className="mr-1" /> {startingTime}
      </div>
      <div>
        <FontAwesomeIcon icon={faPlay} className="mr-1" /> {runtime}
      </div>
    </>
  )
}

export default RuntimeCounter
