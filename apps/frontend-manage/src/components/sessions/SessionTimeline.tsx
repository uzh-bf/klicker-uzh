import {
  faArrowRight,
  faPlay,
  faStop,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
// import getConfig from 'next/config'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
// import { CSVLink } from 'react-csv'

import durationPlugin from 'dayjs/plugin/duration'

import { SessionBlock } from '@klicker-uzh/graphql/dist/ops'
import QRPopup from './QRPopup'

dayjs.extend(durationPlugin)

// const { publicRuntimeConfig } = getConfig()

// function getMessage(num: number, max: number): any {
//   if (num === 0) {
//     return {
//       icon: faPlay,
//       label: 'Ersten Frageblock aktivieren',
//     }
//   }

//   if (num % 2 === 1) {
//     return {
//       icon: faArrowRight,
//       label: 'Aktiven Frageblock schliessen',
//     }
//   }

//   if (num === max) {
//     return {
//       icon: faStop,
//       label: 'Session beenden',
//     }
//   }

//   return {
//     icon: faArrowRight,
//     label: 'Nächsten Frageblock aktivieren',
//   }
// }

const calculateRuntime = ({ startedAt }: { startedAt?: string }): string => {
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

interface Props {
  blocks?: SessionBlock[]
  handleEndSession: () => void
  handleNextBlock: () => void
  handleTogglePublicEvaluation: () => void
  handleActivateBlockById: (blockId: number) => void // TODO: really needed?
  isEvaluationPublic?: boolean
  sessionId: string
  shortname: string
  startedAt?: string
}

const defaultProps = {
  blocks: [],
  isEvaluationPublic: false,
  startedAt: undefined,
}

function SessionTimeline({
  sessionId,
  blocks,
  startedAt,
  isEvaluationPublic,
  handleEndSession,
  handleNextBlock,
  handleTogglePublicEvaluation,
  handleActivateBlockById,
}: Props): React.ReactElement {
  const isFeedbackSession = blocks.length === 0

  const [runtime, setRuntime] = useState(calculateRuntime({ startedAt }))

  const startingTime = runtime.includes('d')
    ? dayjs(startedAt).format('DD.MM HH:mm:ss')
    : dayjs(startedAt).format('HH:mm:ss')

  useEffect(() => {
    const currentRuntime = setInterval(() => {
      setRuntime(calculateRuntime({ startedAt }))
    }, 1000)
    return () => clearInterval(currentRuntime)
  }, [runtime, startedAt])

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap">
      <div className="flex flex-row flex-wrap items-end justify-between flex-1 md:flex-auto md:pb-2">
        <div className="flex flex-row flex-wrap items-end">
          <div>// TODO: IC TIME {startingTime}</div>
          <div className="ml-8">// TODO: IC play circle {runtime}</div>
        </div>

        <div className="flex flex-row flex-wrap items-end mt-1.5 sm:mt-0 gap-2">
          <div className="flex flex-row flex-wrap w-full gap-2 sm:w-max">
            <QRPopup id={sessionId} />
            <a
              className="flex-1"
              href={`/join/${sessionId}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button fluid className="h-10">
                <Button.Icon>
                  <FontAwesomeIcon icon={faUpRightFromSquare} />
                </Button.Icon>
                <Button.Label>Publikumsansicht</Button.Label>
              </Button>
            </a>
          </div>
          <div className="flex flex-row flex-wrap w-full gap-2 sm:w-max sm:mt-0">
            <Link passHref prefetch href={`/sessions/evaluation/${sessionId}`}>
              <a className="flex-1" rel="noopener noreferrer" target="_blank">
                <Button fluid className="h-10" disabled={isFeedbackSession}>
                  <Button.Icon>
                    <FontAwesomeIcon icon={faUpRightFromSquare} />
                  </Button.Icon>
                  <Button.Label>Auswertung (Resultate)</Button.Label>
                </Button>
              </a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

SessionTimeline.defaultProps = defaultProps

export default SessionTimeline
