import {
  faCalendar,
  faPersonChalkboard,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ListButton from '../common/ListButton'
import ErrorStartToast from '../toasts/ErrorStartToast'
import EmbeddingModal from './EmbeddingModal'
import StartModal from './StartModal'

interface SessionListsProps {
  runningSessions: { id: string; name: string }[]
  plannedSessions: { id: string; name: string }[]
}

function SessionLists({ runningSessions, plannedSessions }: SessionListsProps) {
  const t = useTranslations()
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [errorToast, setErrorToast] = useState(false)
  const [startId, setStartId] = useState('')
  const [startName, setStartName] = useState('')
  const [embedOpen, setEmbedOpen] = useState(false)
  const [sessionId, setSessionId] = useState('')

  return (
    <>
      <H4>{t('control.course.runningSessions')}</H4>
      {runningSessions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {runningSessions.map((session) => (
            <div key={session.id} className="flex flex-row items-center gap-2">
              <ListButton
                link={`/session/${session.id}`}
                icon={faPlay}
                label={session.name}
                className={{ icon: 'mr-1', root: 'flex-1' }}
                data={{ cy: `start-session-${session.name}` }}
              />
              <Button
                onClick={() => {
                  setEmbedOpen(true)
                  setSessionId(session.id)
                }}
                className={{
                  root: 'h-full p-2 border border-solid rounded-md bg-uzh-grey-40 border-uzh-grey-100',
                }}
                data={{ cy: `ppt-link-${session.name}` }}
              >
                <Button.Icon className={{ root: 'mr-2' }}>
                  <FontAwesomeIcon icon={faPersonChalkboard} />
                </Button.Icon>
                <Button.Label>PPT</Button.Label>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div>{t('control.course.noRunningSessions')}</div>
      )}

      <H4 className={{ root: 'mt-4' }}>
        {t('control.course.plannedSessions')}
      </H4>
      {plannedSessions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {plannedSessions.map((session) => (
            <div key={session.id} className="flex flex-row items-center gap-2">
              <ListButton
                key={session.id}
                icon={faCalendar}
                label={session.name}
                className={{ icon: 'mr-1' }}
                onClick={() => {
                  setStartModalOpen(true)
                  setStartId(session.id)
                  setStartName(session.name)
                }}
                data={{ cy: `start-session-${session.name}` }}
              />
              <Button
                onClick={() => {
                  setEmbedOpen(true)
                  setSessionId(session.id)
                }}
                className={{
                  root: 'h-full p-2 border border-solid rounded-md bg-uzh-grey-40 border-uzh-grey-100',
                }}
                data={{ cy: `ppt-link-${session.name}` }}
              >
                <Button.Icon className={{ root: 'mr-2' }}>
                  <FontAwesomeIcon icon={faPersonChalkboard} />
                </Button.Icon>
                <Button.Label>PPT</Button.Label>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div>{t('control.course.noPlannedSessions')}</div>
      )}

      <EmbeddingModal
        open={embedOpen}
        setOpen={(newValue: boolean) => setEmbedOpen(newValue)}
        sessionId={sessionId}
      />
      <StartModal
        startId={startId}
        startName={startName}
        startModalOpen={startModalOpen}
        setStartModalOpen={setStartModalOpen}
        setErrorToast={setErrorToast}
      />
      <ErrorStartToast open={errorToast} setOpen={setErrorToast} />
    </>
  )
}

export default SessionLists
