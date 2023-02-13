import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowRight,
  faCheck,
  faHourglassEnd,
  faHourglassStart,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MicroSession } from '@klicker-uzh/graphql/dist/ops'
import { Button, ThemeContext } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext } from 'react'
import Ellipsis from '../common/Ellipsis'

interface MicroSessionProps {
  microSession: Partial<MicroSession>
}

function MicroSessionTile({ microSession }: MicroSessionProps) {
  const theme = useContext(ThemeContext)
  const router = useRouter()

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
    <Link
      href={`${process.env.NEXT_PUBLIC_PWA_URL}/micro/${microSession.id}/`}
      target="_blank"
    >
      <Button
        key={microSession.id}
        className={{
          root: 'p-2 border border-solid rounded h-36 w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80 flex flex-col justify-between',
        }}
      >
        <div>
          <div className="flex flex-row justify-between">
            <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
              {microSession.name || ''}
            </Ellipsis>

            {statusIcon}
          </div>
          <div className="mb-1 italic">
            {microSession.numOfInstances || '0'} Fragen
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faHourglassStart} />
            <div>Start: {scheduledStartAtString}</div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faHourglassEnd} />
            <div>Ende: {scheduledEndAtString}</div>
          </div>
          {isFuture && (
            <Button
              basic
              className={{ root: theme.primaryText }}
              onClick={() =>
                router.push({
                  pathname: '/',
                  query: {
                    sessionId: microSession.id,
                    editMode: 'microSession',
                  },
                })
              }
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faArrowRight} />
              </Button.Icon>
              <Button.Label>Micro-Session bearbeiten</Button.Label>
            </Button>
          )}
        </div>
      </Button>
    </Link>
  )
}

export default MicroSessionTile
