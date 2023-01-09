import { faCalendar, faPlay } from '@fortawesome/free-solid-svg-icons'
import { H4 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import ListButton from '../../components/common/ListButton'

interface SessionListsProps {
  runningSessions: { id: string; displayName: string }[]
  plannedSessions: { id: string; displayName: string }[]
}

function SessionLists({ runningSessions, plannedSessions }: SessionListsProps) {
  const router = useRouter()

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
              label={session.displayName}
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
              label={`Starten: ${session.displayName}`}
              className={{ icon: 'mr-1' }}
              onClick={() => {
                // TODO: start session after possibly asking for confirmation

                // TODO: if successful, rerouter to session page
                router.push(`/session/${session.id}`)
              }}
            />
          ))}
        </div>
      ) : (
        <div>Keine geplanten Sessionen</div>
      )}
    </>
  )
}

export default SessionLists
