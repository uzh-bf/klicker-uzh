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
  DeleteLiveQuizDocument,
  GetSingleCourseDocument,
  Session,
  SessionAccessMode,
  SessionStatus,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { WizardMode } from '../sessions/creation/ElementCreation'
import CopyConfirmationToast from '../toasts/CopyConfirmationToast'
import { getAccessLink, getLTIAccessLink } from './PracticeQuizElement'
import StatusTag from './StatusTag'
import EvaluationLinkLiveQuiz from './actions/EvaluationLinkLiveQuiz'
import RunningLiveQuizLink from './actions/RunningLiveQuizLink'
import StartLiveQuizButton from './actions/StartLiveQuizButton'
import getActivityDuplicationAction from './actions/getActivityDuplicationAction'
import DeletionModal from './modals/DeletionModal'

const statusMap = {
  PREPARED: <FontAwesomeIcon icon={faClock} />,
  SCHEDULED: <FontAwesomeIcon icon={faCalculator} />,
  RUNNING: <FontAwesomeIcon icon={faPlay} />,
  COMPLETED: <FontAwesomeIcon icon={faCheck} />,
}

interface LiveQuizElementProps {
  session: Pick<
    Session,
    | 'id'
    | 'status'
    | 'name'
    | 'numOfBlocks'
    | 'numOfQuestions'
    | 'isGamificationEnabled'
    | 'accessMode'
  >
}

function LiveQuizElement({ session }: LiveQuizElementProps) {
  const t = useTranslations()
  const router = useRouter()

  const [copyToast, setCopyToast] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const [deleteLiveQuiz] = useMutation(DeleteLiveQuizDocument, {
    variables: { id: session.id },
    update(cache, res) {
      const data = cache.readQuery({
        query: GetSingleCourseDocument,
      })

      if (!data?.course || !res.data?.deleteLiveQuiz) {
        return null
      }

      cache.writeQuery({
        query: GetSingleCourseDocument,
        data: {
          course: {
            ...data.course,
            sessions: data.course.sessions?.filter(
              (session) => session.id !== res.data!.deleteLiveQuiz!.id
            ),
          },
        },
      })
    },
    optimisticResponse: {
      deleteLiveQuiz: {
        __typename: 'Session',
        id: session.id,
      },
    },
    refetchQueries: [GetSingleCourseDocument],
  })

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/${dataUser?.userProfile?.shortname}`

  return (
    <div
      className="border-uzh-grey-80 flex w-full flex-row justify-between rounded border border-solid p-2"
      data-cy={`session-${session.name}`}
    >
      <div className="flex-1">
        <div className="flex flex-row gap-2">
          <div>{statusMap[session.status]}</div>

          <Ellipsis
            maxLength={50}
            className={{ markdown: 'text-base font-bold' }}
          >
            {session.name}
          </Ellipsis>
        </div>
        <div className="mb-1 text-sm italic">
          {t('manage.sessions.nBlocksQuestions', {
            blocks: session.numOfBlocks,
            questions: session.numOfQuestions,
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
                    name: session.name,
                  }),
                  dataUser?.userProfile?.catalyst
                    ? getLTIAccessLink({
                        href,
                        setCopyToast,
                        t,
                        name: session.name,
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
                  getActivityDuplicationAction({
                    id: session.id,
                    text: t('manage.sessions.duplicateSession'),
                    wizardMode: WizardMode.LiveQuiz,
                    router: router,
                    data: { cy: `duplicate-live-quiz-${session.name}` },
                  }),
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
                    name: session.name,
                  }),
                  dataUser?.userProfile?.catalyst
                    ? getLTIAccessLink({
                        href,
                        setCopyToast,
                        t,
                        name: session.name,
                      })
                    : [],
                  getActivityDuplicationAction({
                    id: session.id,
                    text: t('manage.sessions.duplicateSession'),
                    wizardMode: WizardMode.LiveQuiz,
                    router: router,
                    data: { cy: `duplicate-live-quiz-${session.name}` },
                  }),
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
                    onClick: () => setDeletionModal(true),
                    data: { cy: `delete-live-quiz-${session.name}` },
                  },
                  getActivityDuplicationAction({
                    id: session.id,
                    text: t('manage.sessions.duplicateSession'),
                    wizardMode: WizardMode.LiveQuiz,
                    router: router,
                    data: { cy: `duplicate-live-quiz-${session.name}` },
                  }),
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

      <CopyConfirmationToast open={copyToast} setOpen={setCopyToast} />
      <DeletionModal
        title={t('manage.sessions.deleteLiveQuiz')}
        description={t('manage.sessions.confirmLiveQuizDeletion')}
        elementName={session.name}
        message={t('manage.sessions.liveQuizDeletionHint')}
        deleteElement={deleteLiveQuiz}
        open={deletionModal}
        setOpen={setDeletionModal}
        primaryData={{ cy: 'confirm-delete-live-quiz' }}
        secondaryData={{ cy: 'cancel-delete-live-quiz' }}
      />
    </div>
  )
}

export default LiveQuizElement
