import { useMutation } from '@apollo/client'
import { faClock, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpRightFromSquare,
  faCalculator,
  faCheck,
  faLock,
  faPencil,
  faPlay,
  faTrophy,
  faUpRightFromSquare,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteSessionDocument,
  GetSingleCourseDocument,
  Session,
  SessionAccessMode,
  SessionStatus,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import StatusTag from './StatusTag'
import LiveSessionDeletionModal from './modals/LiveSessionDeletionModal'

interface SessionTileProps {
  session: Partial<Session>
}

function SessionTile({ session }: SessionTileProps) {
  const t = useTranslations()
  const [startSession] = useMutation(StartSessionDocument)
  const [deleteSession] = useMutation(DeleteSessionDocument, {
    variables: { id: session.id || '' },
    refetchQueries: [GetSingleCourseDocument],
  })
  const [deletionModal, setDeletionModal] = useState(false)

  const router = useRouter()

  const statusMap = {
    PREPARED: <FontAwesomeIcon icon={faClock} />,
    SCHEDULED: <FontAwesomeIcon icon={faCalculator} />,
    RUNNING: <FontAwesomeIcon icon={faPlay} />,
    COMPLETED: <FontAwesomeIcon icon={faCheck} />,
  }

  return (
    <div
      key={session.id}
      className="p-2 border border-solid rounded h-44 w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80 flex flex-col justify-between"
      data-cy="session"
    >
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {session.name || ''}
          </Ellipsis>
          <div>{statusMap[session.status || SessionStatus.Prepared]}</div>
        </div>
        <div className="mb-1 italic">
          {t('manage.sessions.nBlocksQuestions', {
            blocks: session.numOfBlocks || '0',
            questions: session.numOfQuestions || '0',
          })}
        </div>
        {(session.status === SessionStatus.Scheduled ||
          session.status === SessionStatus.Prepared) && (
          <div className="flex flex-col">
            <Button
              basic
              className={{ root: 'text-primary' }}
              onClick={() =>
                router.push({
                  pathname: '/',
                  query: { sessionId: session.id, editMode: 'liveSession' },
                })
              }
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faPencil} />
              </Button.Icon>
              <Button.Label>{t('manage.sessions.editSession')}</Button.Label>
            </Button>
            <Button
              basic
              className={{ root: 'text-primary' }}
              onClick={async () => {
                try {
                  await startSession({
                    variables: { id: session.id || '' },
                  })
                  router.push(`/sessions/${session.id}/cockpit`)
                } catch (error) {
                  console.log(error)
                }
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faPlay} />
              </Button.Icon>
              <Button.Label>{t('manage.sessions.startSession')}</Button.Label>
            </Button>
            <Button
              basic
              className={{ root: 'text-red-600' }}
              onClick={() => setDeletionModal(true)}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faTrashCan} />
              </Button.Icon>
              <Button.Label>{t('manage.sessions.deleteSession')}</Button.Label>
            </Button>
          </div>
        )}
        {session.status === SessionStatus.Running && (
          <div className="flex flex-row items-center gap-2 text-primary">
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-4" />
            <Link href={`/sessions/${session.id}/cockpit`}>
              {t('manage.course.runningSession')}
            </Link>
          </div>
        )}
        {session.status === SessionStatus.Completed && (
          <div className="flex flex-row items-center gap-2 text-primary">
            <FontAwesomeIcon icon={faUpRightFromSquare} />
            <Link
              href={`/sessions/${session.id}/evaluation`}
              passHref
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('shared.generic.evaluation')}
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-row gap-2 ">
        {session.isGamificationEnabled && (
          <StatusTag color="bg-uzh-red-40" status="Gamified" icon={faTrophy} />
        )}
        {session.accessMode === SessionAccessMode.Public && (
          <StatusTag
            color="bg-green-300"
            status={t('manage.course.publicAccess')}
            icon={faUserGroup}
          />
        )}
        {session.accessMode === SessionAccessMode.Restricted && (
          <StatusTag
            color="bg-red-300"
            status={t('manage.course.restrictedAccess')}
            icon={faLock}
          />
        )}
      </div>
      <LiveSessionDeletionModal
        deleteSession={deleteSession}
        title={session.name || ''}
        open={deletionModal}
        setOpen={setDeletionModal}
      />
    </div>
  )
}

export default SessionTile
