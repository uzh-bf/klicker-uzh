import { useMutation } from '@apollo/client'
import { faClock, faCopy } from '@fortawesome/free-regular-svg-icons'
import {
  IconDefinition,
  faArrowUpRightFromSquare,
  faCalendarDays,
  faCheck,
  faCode,
  faPencil,
  faPlay,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteSessionDocument,
  GetUserRunningSessionsDocument,
  GetUserSessionsDocument,
  SessionBlock,
  SessionStatus,
  Session as SessionType,
  SoftDeleteLiveSessionDocument,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Collapsible, H3 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import DeletionModal from '../courses/modals/DeletionModal'
import EmbeddingModal from './EmbeddingModal'
import LiveQuizNameChangeModal from './LiveQuizNameChangeModal'
import { WizardMode } from './creation/ElementCreation'

interface SessionProps {
  session: SessionType
}

function Session({ session }: SessionProps) {
  const t = useTranslations()
  const router = useRouter()

  const [startSession] = useMutation(StartSessionDocument, {
    variables: { id: session.id },
    refetchQueries: [
      {
        query: GetUserRunningSessionsDocument,
      },
    ],
  })

  const [deleteSession] = useMutation(DeleteSessionDocument, {
    variables: { id: session.id },
    update(cache) {
      const data = cache.readQuery({
        query: GetUserSessionsDocument,
      })
      cache.writeQuery({
        query: GetUserSessionsDocument,
        data: {
          userSessions:
            data?.userSessions?.filter((e) => e.id !== session.id) ?? [],
        },
      })
    },
    optimisticResponse: {
      deleteSession: {
        __typename: 'Session',
        id: session.id,
      },
    },
  })

  const [softDeleteLiveSession] = useMutation(SoftDeleteLiveSessionDocument, {
    variables: { id: session.id },
    update(cache) {
      const data = cache.readQuery({
        query: GetUserSessionsDocument,
      })
      cache.writeQuery({
        query: GetUserSessionsDocument,
        data: {
          userSessions:
            data?.userSessions?.filter((e) => e.id !== session.id) ?? [],
        },
      })
    },
    optimisticResponse: {
      softDeleteLiveSession: {
        __typename: 'Session',
        id: session.id,
      },
    },
  })

  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)
  const [deletionModal, setDeletionModal] = useState<boolean>(false)
  const [softDeletionModal, setSoftDeletionModal] = useState<boolean>(false)
  const [changeName, setChangeName] = useState<boolean>(false)

  const timeIcon: Record<SessionStatus, IconDefinition> = {
    [SessionStatus.Prepared]: faCalendarDays,
    [SessionStatus.Scheduled]: faClock,
    [SessionStatus.Running]: faPlay,
    [SessionStatus.Completed]: faCheck,
  }
  const timeStamp: Record<SessionStatus, string> = {
    [SessionStatus.Prepared]: session.createdAt,
    [SessionStatus.Scheduled]: session.createdAt,
    [SessionStatus.Running]: session.startedAt,
    [SessionStatus.Completed]: session.finishedAt,
  }

  return (
    <>
      <div key={session.id} className="rounded border p-1" data-cy="session">
        {/* // TODO: remove additional tailwind styles, which are not imported correctly */}
        {/* <div className="col-span-1 col-span-2 col-span-3 col-span-4 col-span-5" /> */}
        <Collapsible
          className={{ root: 'border-0 !py-0.5' }}
          key={session.id}
          open={showDetails && session.id === selectedSession}
          onChange={() => {
            if (session.id === selectedSession) {
              setShowDetails(!showDetails)
            } else {
              setShowDetails(true)
              setSelectedSession(session.id)
            }
          }}
          staticContent={
            <div
              className="flex flex-row justify-between"
              data-cy="session-block"
            >
              <div className="flex flex-row items-center gap-3">
                <H3 className={{ root: 'mb-0' }}>{session.name}</H3>
                <FontAwesomeIcon
                  icon={faPencil}
                  size="sm"
                  onClick={() => setChangeName(true)}
                  className="hover:cursor-pointer"
                  data-cy={`change-liveQuiz-name-${session.name}`}
                />
              </div>
              <div className="flex flex-row gap-5">
                {session.blocks?.length !== 0 && (
                  <>
                    <Button
                      basic
                      onClick={() => setEmbedModalOpen(true)}
                      className={{
                        root: 'hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm',
                      }}
                      data={{ cy: `show-embedding-modal-${session.name}` }}
                    >
                      <FontAwesomeIcon icon={faCode} size="sm" />
                      {t('manage.sessions.embeddingEvaluation')}
                    </Button>
                    <EmbeddingModal
                      key={session.id}
                      open={embedModalOpen}
                      onClose={() => setEmbedModalOpen(false)}
                      sessionId={session.id}
                      questions={session.blocks
                        ?.flatMap((block: SessionBlock) => block.instances)
                        .filter(
                          (instance) =>
                            typeof instance !== 'undefined' && instance !== null
                        )}
                    />
                  </>
                )}

                {SessionStatus.Running === session.status && (
                  <Link
                    href={`/quizzes/${session.id}/cockpit`}
                    legacyBehavior
                    passHref
                  >
                    <a
                      className="hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm"
                      data-cy={`session-cockpit-${session.name}`}
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      <div>{t('manage.sessions.lecturerCockpit')}</div>
                    </a>
                  </Link>
                )}
                {SessionStatus.Completed === session.status && (
                  <Link
                    href={`/quizzes/${session.id}/evaluation`}
                    legacyBehavior
                    passHref
                  >
                    <a
                      className="hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm"
                      data-cy={`session-evaluation-${session.name}`}
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      <div>{t('manage.sessions.sessionEvaluation')}</div>
                    </a>
                  </Link>
                )}
                {(SessionStatus.Prepared === session.status ||
                  SessionStatus.Scheduled === session.status) && (
                  <Button
                    basic
                    onClick={async () => {
                      await startSession()
                      router.push(`sessions/${session.id}/cockpit`)
                    }}
                    data={{ cy: `start-session-${session.name}` }}
                  >
                    <div className="hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm">
                      <FontAwesomeIcon icon={faPlay} size="sm" />
                      <div>{t('manage.sessions.startSession')}</div>
                    </div>
                  </Button>
                )}
                <div className="flex flex-row items-center gap-1 text-sm">
                  <FontAwesomeIcon
                    icon={timeIcon[session.status]}
                    className="mr-1"
                  />
                  {dayjs(timeStamp[session.status]).format('YYYY-MM-DD HH:mm')}
                </div>
              </div>
            </div>
          }
          closedContent={
            <div className="italic">
              {t('manage.sessions.nBlocksQuestions', {
                blocks: session.numOfBlocks,
                questions: session.numOfQuestions,
              })}
            </div>
          }
          primary={
            <div className="float-right flex flex-row gap-1">
              <Button
                className={{ root: 'px-3 py-1 text-sm' }}
                onClick={() =>
                  router.push({
                    pathname: '/',
                    query: {
                      elementId: session.id,
                      duplicationMode: WizardMode.LiveQuiz,
                    },
                  })
                }
                data={{ cy: `duplicate-session-${session.name}` }}
              >
                <Button.Icon className={{ root: 'text-slate-600' }}>
                  <FontAwesomeIcon icon={faCopy} />
                </Button.Icon>
                <Button.Label>
                  {t('manage.sessions.duplicateSession')}
                </Button.Label>
              </Button>
              {(SessionStatus.Prepared === session.status ||
                SessionStatus.Scheduled === session.status) && (
                <>
                  <Button
                    className={{ root: 'px-3 py-1 text-sm' }}
                    onClick={() =>
                      router.push({
                        pathname: '/',
                        query: {
                          elementId: session.id,
                          editMode: WizardMode.LiveQuiz,
                        },
                      })
                    }
                    data={{ cy: `edit-session-${session.name}` }}
                  >
                    <Button.Icon className={{ root: 'text-slate-600' }}>
                      <FontAwesomeIcon icon={faPencil} />
                    </Button.Icon>
                    <Button.Label>
                      {t('manage.sessions.editSession')}
                    </Button.Label>
                  </Button>
                  <Button
                    className={{
                      root: 'border-red-600 px-3 py-1 text-sm',
                    }}
                    onClick={() => setDeletionModal(true)}
                    data={{ cy: `delete-session-${session.name}` }}
                  >
                    <Button.Icon className={{ root: 'text-red-400' }}>
                      <FontAwesomeIcon icon={faTrash} />
                    </Button.Icon>
                    <Button.Label>
                      {t('manage.sessions.deleteSession')}
                    </Button.Label>
                  </Button>
                </>
              )}
              {SessionStatus.Completed === session.status && (
                <Button
                  className={{
                    root: 'border-red-600 px-3 py-1 text-sm',
                  }}
                  onClick={() => setSoftDeletionModal(true)}
                  data={{ cy: `delete-past-session-${session.name}` }}
                >
                  <Button.Icon className={{ root: 'text-red-400' }}>
                    <FontAwesomeIcon icon={faTrash} />
                  </Button.Icon>
                  <Button.Label>
                    {t('manage.sessions.deleteSession')}
                  </Button.Label>
                </Button>
              )}
            </div>
          }
        >
          <div className="my-2 flex flex-row gap-2 overflow-y-scroll">
            {session.blocks?.map((block, index) => (
              <div key={block.id} className="flex flex-col gap-1">
                <div className="italic">
                  {t('manage.sessions.blockXQuestions', {
                    block: index + 1,
                    questions: block.instances?.length,
                  })}
                </div>
                {block.instances?.map((instance) => (
                  <div
                    key={instance.id}
                    className="border-uzh-grey-100 w-60 rounded-md border border-solid text-sm"
                  >
                    <div className="bg-uzh-grey-40 flex flex-row justify-between px-1 py-0.5">
                      <Ellipsis
                        className={{ markdown: 'text-base font-bold' }}
                        maxLength={20}
                      >
                        {instance.questionData!.name}
                      </Ellipsis>

                      <div className="italic">
                        ({t(`shared.${instance.questionData!.type}.short`)})
                      </div>
                    </div>
                    <Ellipsis
                      maxLength={50}
                      className={{ markdown: 'px-1 text-sm' }}
                    >
                      {instance.questionData!.content}
                    </Ellipsis>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Collapsible>
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
      <LiveQuizNameChangeModal
        quizId={session.id}
        name={session.name}
        displayName={session.displayName}
        open={changeName}
        setOpen={setChangeName}
      />
    </>
  )
}

export default Session
