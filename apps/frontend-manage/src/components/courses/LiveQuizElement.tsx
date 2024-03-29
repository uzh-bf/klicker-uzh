import { useMutation } from '@apollo/client'
import { WizardMode } from '@components/sessions/creation/SessionCreation'
import { faClock, faHandPointer } from '@fortawesome/free-regular-svg-icons'
import {
  faCalculator,
  faCheck,
  faLock,
  faPencil,
  faPlay,
  faTrashCan,
  faTrophy,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteSessionDocument,
  GetSingleCourseDocument,
  Session,
  SessionAccessMode,
  SessionStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import StatusTag from './StatusTag'
import EvaluationLinkLiveQuiz from './actions/EvaluationLinkLiveQuiz'
import RunningLiveQuizLink from './actions/RunningLiveQuizLink'
import StartLiveQuizButton from './actions/StartLiveQuizButton'
import LiveSessionDeletionModal from './modals/LiveSessionDeletionModal'

interface LiveQuizElementProps {
  session: Partial<Session>
}

function LiveQuizElement({ session }: LiveQuizElementProps) {
  const t = useTranslations()
  const router = useRouter()

  const [deletionModal, setDeletionModal] = useState(false)
  const [deleteSession] = useMutation(DeleteSessionDocument, {
    variables: { id: session.id || '' },
    refetchQueries: [GetSingleCourseDocument],
  })

  const statusMap = {
    PREPARED: <FontAwesomeIcon icon={faClock} />,
    SCHEDULED: <FontAwesomeIcon icon={faCalculator} />,
    RUNNING: <FontAwesomeIcon icon={faPlay} />,
    COMPLETED: <FontAwesomeIcon icon={faCheck} />,
  }

  return (
    <div
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
                <StartLiveQuizButton liveQuiz={session} />
                <Dropdown
                  data={{ cy: `live-quiz-actions-${session.name}` }}
                  className={{
                    item: 'p-1 hover:bg-gray-200',
                    viewport: 'bg-white',
                  }}
                  trigger={t('manage.course.otherActions')}
                  items={[
                    {
                      label: (
                        <div className="flex flex-row items-center gap-2 text-primary cursor-pointer">
                          <FontAwesomeIcon icon={faPencil} />
                          <div>{t('manage.sessions.editSession')}</div>
                        </div>
                      ),
                      onClick: () =>
                        router.push({
                          pathname: '/',
                          query: {
                            sessionId: session.id,
                            editMode: WizardMode.LiveQuiz,
                          },
                        }),
                      data: { cy: `edit-live-quiz-${session.name}` },
                    },
                    {
                      label: (
                        <div className="flex flex-row items-center text-red-600 gap-2 cursor-pointer">
                          <FontAwesomeIcon icon={faTrashCan} />
                          <div>{t('manage.sessions.deleteSession')}</div>
                        </div>
                      ),
                      onClick: () => setDeletionModal(true),
                      data: { cy: `delete-live-quiz-${session.name}` },
                    },
                  ]}
                  triggerIcon={faHandPointer}
                />
              </>
            )}
            {session.status === SessionStatus.Running && (
              <RunningLiveQuizLink liveQuiz={session} />
            )}
            {session.status === SessionStatus.Completed && (
              <EvaluationLinkLiveQuiz liveQuiz={session} />
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

export default LiveQuizElement
