import { useMutation } from '@apollo/client'
import { WizardMode } from '@components/sessions/creation/SessionCreation'
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

interface LiveSessionElementProps {
  session: Partial<Session>
}

function LiveSessionElement({ session }: LiveSessionElementProps) {
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
      className="w-full p-2 border border-solid rounded border-uzh-grey-80"
      data-cy={`session-${session.name}`}
    >
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis
            maxLength={25}
            className={{ markdown: 'font-bold text-base' }}
          >
            {session.name || ''}
          </Ellipsis>
          <div className="flex flex-row items-center gap-3.5 text-sm">
            {(session.status === SessionStatus.Scheduled ||
              session.status === SessionStatus.Prepared) && (
              <>
                <Button
                  basic
                  className={{ root: 'text-primary' }}
                  onClick={() =>
                    router.push({
                      pathname: '/',
                      query: {
                        sessionId: session.id,
                        editMode: WizardMode.LiveQuiz,
                      },
                    })
                  }
                  data={{ cy: `edit-live-quiz-${session.name}` }}
                >
                  <Button.Icon>
                    <FontAwesomeIcon icon={faPencil} />
                  </Button.Icon>
                  <Button.Label>
                    {t('manage.sessions.editSession')}
                  </Button.Label>
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
                  data={{ cy: `start-live-quiz-${session.name}` }}
                >
                  <Button.Icon>
                    <FontAwesomeIcon icon={faPlay} />
                  </Button.Icon>
                  <Button.Label>
                    {t('manage.sessions.startSession')}
                  </Button.Label>
                </Button>
                <Button
                  basic
                  className={{ root: 'text-red-600' }}
                  onClick={() => setDeletionModal(true)}
                  data={{ cy: `delete-live-quiz-${session.name}` }}
                >
                  <Button.Icon>
                    <FontAwesomeIcon icon={faTrashCan} />
                  </Button.Icon>
                  <Button.Label>
                    {t('manage.sessions.deleteSession')}
                  </Button.Label>
                </Button>
              </>
            )}
            {session.status === SessionStatus.Running && (
              <div className="flex flex-row items-center gap-2 text-primary">
                <FontAwesomeIcon
                  icon={faArrowUpRightFromSquare}
                  className="w-4"
                />
                <Link
                  legacyBehavior
                  passHref
                  href={`/sessions/${session.id}/cockpit`}
                >
                  <a data-cy={`open-cockpit-session-${session.name}`}>
                    {t('manage.course.runningSession')}
                  </a>
                </Link>
              </div>
            )}
            {session.status === SessionStatus.Completed && (
              <div className="flex flex-row items-center gap-2 text-primary">
                <FontAwesomeIcon icon={faUpRightFromSquare} />
                <Link
                  href={`/sessions/${session.id}/evaluation`}
                  target="_blank"
                  rel="noopener noreferrer"
                  passHref
                  legacyBehavior
                >
                  <a data-cy={`open-evaluation-session-${session.name}`}>
                    {t('shared.generic.evaluation')}
                  </a>
                </Link>
              </div>
            )}
            <div>{statusMap[session.status || SessionStatus.Prepared]}</div>
          </div>
        </div>
        <div className="mb-1 text-sm italic">
          {t('manage.sessions.nBlocksQuestions', {
            blocks: session.numOfBlocks || '0',
            questions: session.numOfQuestions || '0',
          })}
        </div>
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

export default LiveSessionElement
