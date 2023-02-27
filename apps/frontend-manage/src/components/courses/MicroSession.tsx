import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faHourglassEnd,
  faHourglassStart,
  faLink,
  faPencil,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MicroSession } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, ThemeContext, Toast } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface MicroSessionProps {
  microSession: Partial<MicroSession>
}

function MicroSessionTile({ microSession }: MicroSessionProps) {
  const theme = useContext(ThemeContext)
  const router = useRouter()

  const [copyToast, setCopyToast] = useState(false)

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
    <div className="p-2 border border-solid rounded h-44 w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80">
      <div className="flex flex-row items-center justify-between">
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
      <Button
        basic
        onClick={() => {
          navigator.clipboard.writeText(
            `${process.env.NEXT_PUBLIC_PWA_URL}/micro/${microSession.id}/`
          )
          setCopyToast(true)
        }}
        className={{
          root: twMerge('flex flex-row items-center gap-1', theme.primaryText),
        }}
      >
        <FontAwesomeIcon icon={faLink} size="sm" className="w-4" />
        <div>Zugriffslink kopieren</div>
      </Button>
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
            <FontAwesomeIcon icon={faPencil} />
          </Button.Icon>
          <Button.Label>Micro-Session bearbeiten</Button.Label>
        </Button>
      )}
      <Toast
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        className={{ root: 'w-[24rem]' }}
      >
        Der Link zur Micro-Session wurde erfolgreich in die Zwischenablage
        kopiert.
      </Toast>
    </div>
  )
}

export default MicroSessionTile
