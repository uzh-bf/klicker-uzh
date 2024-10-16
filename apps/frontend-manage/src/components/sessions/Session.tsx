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
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteLiveQuizDocument,
  GetUserRunningSessionsDocument,
  GetUserSessionsDocument,
  SessionBlock,
  SessionStatus,
  Session as SessionType,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Collapsible, H3, H4 } from '@uzh-bf/design-system'
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

  const [startSession, { loading: startingQuiz }] = useMutation(
    StartSessionDocument,
    {
      variables: { id: session.id },
      refetchQueries: [
        {
          query: GetUserRunningSessionsDocument,
        },
      ],
    }
  )

  const [deleteLiveQuiz] = useMutation(DeleteLiveQuizDocument, {
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
      deleteLiveQuiz: {
        __typename: 'Session',
        id: session.id,
      },
    },
  })

  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)
  const [deletionModal, setDeletionModal] = useState<boolean>(false)
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
                    href={`/sessions/${session.id}/cockpit`}
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
                    href={`/sessions/${session.id}/evaluation`}
                    legacyBehavior
                    passHref
                  >
                    <a
                      className="hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm"
                      data-cy={`session-evaluation-${session.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                    disabled={startingQuiz}
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
              )}
              {(SessionStatus.Prepared === session.status ||
                SessionStatus.Scheduled === session.status ||
                SessionStatus.Completed === session.status) && (
                <Button
                  className={{
                    root: 'border-red-600 px-3 py-1 text-sm',
                  }}
                  onClick={() => setDeletionModal(true)}
                  data={{ cy: `delete-live-quiz-${session.name}` }}
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
          <div className="mb-6 mt-4 flex flex-row gap-4 overflow-x-auto overflow-y-hidden">
            {session.blocks?.map((block, index) => (
              <div
                key={block.id}
                className="w-64 min-w-52 border-r border-black pr-4 last:border-r-0 last:pr-0"
              >
                <div className="flex flex-row justify-between">
                  <H4>
                    {t('shared.generic.blockN', {
                      number: index + 1,
                    })}
                  </H4>
                  {block.numOfParticipants ? (
                    <div className="flex flex-row items-center">
                      <div>{block.numOfParticipants}</div>
                      <FontAwesomeIcon
                        icon={faUserGroup}
                        className="ml-1 w-4"
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  {block.instances?.map((instance) => (
                    <Link
                      href={`/questions/${instance.questionData!.questionId}`}
                      className="text-sm hover:text-slate-700"
                      key={instance.id}
                      legacyBehavior
                      passHref
                    >
                      <a
                        data-cy={`open-question-live-quiz-${instance.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="hover:text-primary-100 flex flex-row items-center justify-between gap-1.5 border-b text-sm">
                          <div>
                            {instance.questionData?.name} (
                            {t(`shared.${instance.questionData!.type}.short`)})
                          </div>
                          <FontAwesomeIcon
                            icon={faArrowUpRightFromSquare}
                            className="h-3 w-3"
                          />
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
                <div className="float-right text-sm">
                  {t('shared.generic.Nelements', {
                    number: block.instances?.length,
                  })}
                </div>
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
        deleteElement={deleteLiveQuiz}
        open={deletionModal}
        setOpen={setDeletionModal}
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
