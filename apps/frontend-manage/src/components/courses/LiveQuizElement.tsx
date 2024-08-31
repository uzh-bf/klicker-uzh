import { useMutation, useQuery } from '@apollo/client'
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
  SoftDeleteLiveSessionDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { WizardMode } from '../sessions/creation/ElementCreation'
import { getAccessLink, getLTIAccessLink } from './PracticeQuizElement'
import StatusTag from './StatusTag'
import EvaluationLinkLiveQuiz from './actions/EvaluationLinkLiveQuiz'
import RunningLiveQuizLink from './actions/RunningLiveQuizLink'
import StartLiveQuizButton from './actions/StartLiveQuizButton'
import DeletionModal from './modals/DeletionModal'

const statusMap = {
  PREPARED: <FontAwesomeIcon icon={faClock} />,
  SCHEDULED: <FontAwesomeIcon icon={faCalculator} />,
  RUNNING: <FontAwesomeIcon icon={faPlay} />,
  COMPLETED: <FontAwesomeIcon icon={faCheck} />,
}

interface LiveQuizElementProps {
  session: Partial<Session>
}

function LiveQuizElement({ session }: LiveQuizElementProps) {
  const t = useTranslations()
  const router = useRouter()

  const [copyToast, setCopyToast] = useState(false)

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const [deletionModal, setDeletionModal] = useState(false)
  const [softDeletionModal, setSoftDeletionModal] = useState(false)

  // TODO: implement update and optimistic response
  const [deleteSession] = useMutation(DeleteSessionDocument, {
    variables: { id: session.id || '' },
    refetchQueries: [GetSingleCourseDocument],
  })

  // TODO: implement update and optimistic response
  const [softDeleteLiveSession] = useMutation(SoftDeleteLiveSessionDocument, {
    variables: { id: session.id || '' },
    refetchQueries: [GetSingleCourseDocument],
  })

  const statusMap = {
    PREPARED: <FontAwesomeIcon icon={faClock} />,
    SCHEDULED: <FontAwesomeIcon icon={faCalculator} />,
    RUNNING: <FontAwesomeIcon icon={faPlay} />,
    COMPLETED: <FontAwesomeIcon icon={faCheck} />,
  }

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/${dataUser?.userProfile?.shortname}`

  return (
    <div
      className="border-uzh-grey-80 flex w-full flex-row justify-between rounded border border-solid p-2"
      data-cy={`session-${session.name}`}
    >
      <div className="flex-1">
        <div className="flex flex-row gap-2">
          <div>{statusMap[session.status || SessionStatus.Prepared]}</div>

          <Ellipsis
            maxLength={50}
            className={{ markdown: 'text-base font-bold' }}
          >
            {session.name || ''}
          </Ellipsis>
        </div>
        <div className="mb-1 text-sm italic">
          {t('manage.sessions.nBlocksQuestions', {
            blocks: session.numOfBlocks || '0',
            questions: session.numOfQuestions || '0',
          })}
        </div>
      </div>

      <div className="flex flex-col items-end justify-between gap-4">
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
                  getAccessLink({
                    href,
                    setCopyToast,
                    t,
                    name: session.name ?? '',
                  }),
                  dataUser?.userProfile?.catalyst
                    ? getLTIAccessLink({
                        href,
                        setCopyToast,
                        t,
                        name: session.name ?? '',
                      })
                    : [],
                  {
                    label: (
                      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-2">
                        <FontAwesomeIcon icon={faPencil} />
                        <div>{t('manage.sessions.editSession')}</div>
                      </div>
                    ),
                    onClick: () =>
                      router.push({
                        pathname: '/',
                        query: {
                          elementId: session.id,
                          editMode: WizardMode.LiveQuiz,
                        },
                      }),
                    data: { cy: `edit-live-quiz-${session.name}` },
                  },
                  {
                    label: (
                      <div className="flex cursor-pointer flex-row items-center gap-2 text-red-600">
                        <FontAwesomeIcon icon={faTrashCan} />
                        <div>{t('manage.sessions.deleteSession')}</div>
                      </div>
                    ),
                    onClick: () => setDeletionModal(true),
                    data: { cy: `delete-live-quiz-${session.name}` },
                  },
                ].flat()}
                triggerIcon={faHandPointer}
              />
            </>
          )}
          {session.status === SessionStatus.Running && (
            <>
              <RunningLiveQuizLink liveQuiz={session} />
              <Dropdown
                data={{ cy: `live-quiz-actions-${session.name}` }}
                className={{
                  item: 'p-1 hover:bg-gray-200',
                  viewport: 'bg-white',
                }}
                trigger={t('manage.course.otherActions')}
                items={[
                  getAccessLink({
                    href,
                    setCopyToast,
                    t,
                    name: session.name ?? '',
                  }),
                  dataUser?.userProfile?.catalyst
                    ? getLTIAccessLink({
                        href,
                        setCopyToast,
                        t,
                        name: session.name ?? '',
                      })
                    : [],
                ].flat()}
                triggerIcon={faHandPointer}
              />
            </>
          )}
          {session.status === SessionStatus.Completed && (
            <>
              <EvaluationLinkLiveQuiz liveQuiz={session} />
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
                      <div className="flex cursor-pointer flex-row items-center gap-2 text-red-600">
                        <FontAwesomeIcon icon={faTrashCan} />
                        <div>{t('manage.sessions.deleteSession')}</div>
                      </div>
                    ),
                    onClick: () => setSoftDeletionModal(true),
                    data: { cy: `delete-past-live-quiz-${session.name}` },
                  },
                ]}
                triggerIcon={faHandPointer}
              />
            </>
          )}
        </div>
        <div className="flex flex-row gap-2">
          {session.isGamificationEnabled && (
            <StatusTag
              color="bg-uzh-red-40"
              status="Gamified"
              icon={faTrophy}
            />
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
      </div>

      <DeletionModal
        title={t('manage.sessions.deleteLiveQuiz')}
        description={t('manage.sessions.confirmLiveQuizDeletion')}
        elementName={session.name || ''}
        message={t('manage.sessions.liveQuizDeletionHint')}
        deleteElement={deleteSession}
        open={deletionModal}
        setOpen={setDeletionModal}
        primaryData={{ cy: 'confirm-delete-live-quiz' }}
        secondaryData={{ cy: 'cancel-delete-live-quiz' }}
      />
      <DeletionModal
        title={t('manage.sessions.deleteLiveQuiz')}
        description={t('manage.sessions.confirmLiveQuizDeletion')}
        elementName={session.name || ''}
        message={t('manage.sessions.pastLiveQuizDeletionHint')}
        deleteElement={softDeleteLiveSession}
        open={softDeletionModal}
        setOpen={setSoftDeletionModal}
        primaryData={{ cy: 'confirm-delete-live-quiz' }}
        secondaryData={{ cy: 'cancel-delete-live-quiz' }}
      />
    </div>
  )
}

export default LiveQuizElement
