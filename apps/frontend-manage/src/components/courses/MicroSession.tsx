import Ellipsis from '@components/common/Ellipsis'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faHourglassEnd,
  faHourglassStart,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MicroSession } from '@klicker-uzh/graphql/dist/ops'

interface MicroSessionProps {
  microSession: Partial<MicroSession>
}

function MicroSessionTile({ microSession }: MicroSessionProps) {
  const scheduledStartAt = new Date(microSession.scheduledStartAt)
  const scheduledEndAt = new Date(microSession.scheduledEndAt)

  const isFuture = scheduledStartAt.getTime() > Date.now()
  const now = new Date()
  const isRunning = now >= scheduledStartAt && now <= scheduledEndAt

  // format scheduled start and end times as strings
  const scheduledStartAtString = scheduledStartAt.toLocaleString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const scheduledEndAtString = scheduledEndAt.toLocaleString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const statusIcon = isFuture ? (
    <FontAwesomeIcon icon={faClock} />
  ) : isRunning ? (
    <FontAwesomeIcon icon={faPlay} />
  ) : (
    <FontAwesomeIcon icon={faCheck} />
  )

  return (
    <div
      key={microSession.id}
      className="p-2 border border-solid rounded h-36 min-w-[18rem] max-w-[18rem] border-uzh-grey-80 flex flex-col justify-between"
    >
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {microSession.name || ''}
          </Ellipsis>

          {statusIcon}
        </div>
        <div className="mb-1 italic">
          {microSession.instances?.length || '0'} Fragen
        </div>
        <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHourglassStart} />
          <div>Start: {scheduledStartAtString}</div>
        </div>
        <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHourglassEnd} />
          <div>Ende: {scheduledEndAtString}</div>
        </div>
      </div>
    </div>
  )
}

export default MicroSessionTile
