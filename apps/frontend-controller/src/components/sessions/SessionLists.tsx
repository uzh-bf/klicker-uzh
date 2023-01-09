import SessionStartToast from '@components/toasts/SessionStartToast'
import { faCalendar, faPlay } from '@fortawesome/free-solid-svg-icons'
import { H4 } from '@uzh-bf/design-system'
import { useState } from 'react'
import ListButton from '../common/ListButton'
import StartModal from './StartModal'

interface SessionListsProps {
  runningSessions: { id: string; name: string }[]
  plannedSessions: { id: string; name: string }[]
}

function SessionLists({ runningSessions, plannedSessions }: SessionListsProps) {
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [errorToast, setErrorToast] = useState(false)
  const [startId, setStartId] = useState('')
  const [startName, setStartName] = useState('')

  return (
    <>
      <H4>Laufende Sessionen</H4>
      {runningSessions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {runningSessions.map((session) => (
            <ListButton
              key={session.id}
              link={`/session/${session.id}`}
              icon={faPlay}
              label={session.name}
              className={{ icon: 'mr-1' }}
            />
          ))}
        </div>
      ) : (
        <div>Keine laufenden Sessionen</div>
      )}

      <H4 className={{ root: 'mt-4' }}>Geplante Sessionen</H4>
      {plannedSessions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {plannedSessions.map((session) => (
            <ListButton
              key={session.id}
              icon={faCalendar}
              label={`Starten: ${session.name}`}
              className={{ icon: 'mr-1' }}
              onClick={() => {
                setStartModalOpen(true)
                setStartId(session.id)
                setStartName(session.name)
              }}
            />
          ))}
        </div>
      ) : (
        <div>Keine geplanten Sessionen</div>
      )}

      <StartModal
        startId={startId}
        startName={startName}
        startModalOpen={startModalOpen}
        setStartModalOpen={setStartModalOpen}
        setErrorToast={setErrorToast}
      />
      <SessionStartToast open={errorToast} setOpen={setErrorToast} />
    </>
  )
}

export default SessionLists
