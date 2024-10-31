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
  GetUserLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
  LiveQuiz as LiveQuizType,
  PublicationStatus,
  StartLiveQuizDocument,
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

function LiveQuiz({
  quiz,
}: {
  quiz: Pick<
    LiveQuizType,
    | 'id'
    | 'name'
    | 'displayName'
    | 'status'
    | 'numOfBlocks'
    | 'numOfInstances'
    | 'createdAt'
    | 'startedAt'
    | 'finishedAt'
    | 'blocks'
  >
}) {
  const t = useTranslations()
  const router = useRouter()

  const [startLiveQuiz, { loading: startingQuiz }] = useMutation(
    StartLiveQuizDocument,
    {
      variables: { id: quiz.id },
      update(cache) {
        const data = cache.readQuery({
          query: GetUserRunningLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUserRunningLiveQuizzesDocument,
          data: {
            userRunningLiveQuizzes: [
              ...(data?.userRunningLiveQuizzes ?? []),
              { id: quiz.id, name: quiz.name },
            ],
          },
        })
      },
    }
  )

  const [deleteLiveQuiz] = useMutation(DeleteLiveQuizDocument, {
    variables: { id: quiz.id },
    update(cache) {
      const data = cache.readQuery({
        query: GetUserLiveQuizzesDocument,
      })
      cache.writeQuery({
        query: GetUserLiveQuizzesDocument,
        data: {
          userLiveQuizzes:
            data?.userLiveQuizzes?.filter((q) => q.id !== quiz.id) ?? [],
        },
      })
    },
    optimisticResponse: {
      deleteLiveQuiz: {
        __typename: 'Session',
        id: quiz.id,
      },
    },
  })

  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)
  const [deletionModal, setDeletionModal] = useState<boolean>(false)
  const [changeName, setChangeName] = useState<boolean>(false)

  const timeIcon: Record<PublicationStatus, IconDefinition> = {
    [PublicationStatus.Draft]: faCalendarDays,
    [PublicationStatus.Scheduled]: faClock,
    [PublicationStatus.Published]: faPlay,
    [PublicationStatus.Ended]: faCheck,
    [PublicationStatus.Graded]: faCheck,
  }
  const timeStamp: Record<PublicationStatus, string | null> = {
    [PublicationStatus.Draft]: quiz.createdAt,
    [PublicationStatus.Scheduled]: quiz.createdAt,
    [PublicationStatus.Published]: quiz.startedAt,
    [PublicationStatus.Ended]: quiz.finishedAt,
    [PublicationStatus.Graded]: quiz.finishedAt,
  }

  return (
    <>
      <div key={quiz.id} className="rounded border p-1" data-cy="session">
        {/* // TODO: remove additional tailwind styles, which are not imported correctly */}
        {/* <div className="col-span-1 col-span-2 col-span-3 col-span-4 col-span-5" /> */}
        <Collapsible
          className={{ root: 'border-0 !py-0.5' }}
          key={quiz.id}
          open={showDetails && quiz.id === selectedSession}
          onChange={() => {
            if (quiz.id === selectedSession) {
              setShowDetails(!showDetails)
            } else {
              setShowDetails(true)
              setSelectedSession(quiz.id)
            }
          }}
          staticContent={
            <div
              className="flex flex-row justify-between"
              data-cy="session-block"
            >
              <div className="flex flex-row items-center gap-3">
                <H3 className={{ root: 'mb-0' }}>{quiz.name}</H3>
                <FontAwesomeIcon
                  icon={faPencil}
                  size="sm"
                  onClick={() => setChangeName(true)}
                  className="hover:cursor-pointer"
                  data-cy={`change-liveQuiz-name-${quiz.name}`}
                />
              </div>
              <div className="flex flex-row gap-5">
                {quiz.blocks?.length !== 0 && (
                  <>
                    <Button
                      basic
                      onClick={() => setEmbedModalOpen(true)}
                      className={{
                        root: 'hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm',
                      }}
                      data={{ cy: `show-embedding-modal-${quiz.name}` }}
                    >
                      <FontAwesomeIcon icon={faCode} size="sm" />
                      {t('manage.sessions.embeddingEvaluation')}
                    </Button>
                    <EmbeddingModal
                      key={quiz.id}
                      open={embedModalOpen}
                      onClose={() => setEmbedModalOpen(false)}
                      sessionId={quiz.id}
                      elements={quiz.blocks
                        ?.flatMap((block) => block.elements)
                        .filter(
                          (instance) =>
                            typeof instance !== 'undefined' && instance !== null
                        )}
                    />
                  </>
                )}

                {PublicationStatus.Published === quiz.status && (
                  <Link
                    href={`/sessions/${quiz.id}/cockpit`}
                    legacyBehavior
                    passHref
                  >
                    <a
                      className="hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm"
                      data-cy={`session-cockpit-${quiz.name}`}
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      <div>{t('manage.sessions.lecturerCockpit')}</div>
                    </a>
                  </Link>
                )}
                {PublicationStatus.Ended === quiz.status && (
                  <Link
                    href={`/sessions/${quiz.id}/evaluation`}
                    legacyBehavior
                    passHref
                  >
                    <a
                      className="hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm"
                      data-cy={`session-evaluation-${quiz.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      <div>{t('manage.sessions.sessionEvaluation')}</div>
                    </a>
                  </Link>
                )}
                {(PublicationStatus.Draft === quiz.status ||
                  PublicationStatus.Scheduled === quiz.status) && (
                  <Button
                    basic
                    disabled={startingQuiz}
                    onClick={async () => {
                      await startLiveQuiz()
                      router.push(`sessions/${quiz.id}/cockpit`)
                    }}
                    data={{ cy: `start-session-${quiz.name}` }}
                  >
                    <div className="hover:text-primary-100 flex cursor-pointer flex-row items-center gap-2 text-sm">
                      <FontAwesomeIcon icon={faPlay} size="sm" />
                      <div>{t('manage.sessions.startLiveQuiz')}</div>
                    </div>
                  </Button>
                )}
                <div className="flex flex-row items-center gap-1 text-sm">
                  <FontAwesomeIcon
                    icon={timeIcon[quiz.status]}
                    className="mr-1"
                  />
                  {dayjs(timeStamp[quiz.status]).format('YYYY-MM-DD HH:mm')}
                </div>
              </div>
            </div>
          }
          closedContent={
            <div className="italic">
              {t('manage.sessions.nBlocksQuestions', {
                blocks: quiz.numOfBlocks,
                questions: quiz.numOfInstances,
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
                      elementId: quiz.id,
                      duplicationMode: WizardMode.LiveQuiz,
                    },
                  })
                }
                data={{ cy: `duplicate-session-${quiz.name}` }}
              >
                <Button.Icon className={{ root: 'text-slate-600' }}>
                  <FontAwesomeIcon icon={faCopy} />
                </Button.Icon>
                <Button.Label>
                  {t('manage.sessions.duplicateSession')}
                </Button.Label>
              </Button>
              {(PublicationStatus.Draft === quiz.status ||
                PublicationStatus.Scheduled === quiz.status) && (
                <Button
                  className={{ root: 'px-3 py-1 text-sm' }}
                  onClick={() =>
                    router.push({
                      pathname: '/',
                      query: {
                        elementId: quiz.id,
                        editMode: WizardMode.LiveQuiz,
                      },
                    })
                  }
                  data={{ cy: `edit-session-${quiz.name}` }}
                >
                  <Button.Icon className={{ root: 'text-slate-600' }}>
                    <FontAwesomeIcon icon={faPencil} />
                  </Button.Icon>
                  <Button.Label>
                    {t('manage.sessions.editLiveQuiz')}
                  </Button.Label>
                </Button>
              )}
              {(PublicationStatus.Draft === quiz.status ||
                PublicationStatus.Scheduled === quiz.status ||
                PublicationStatus.Ended === quiz.status) && (
                <Button
                  className={{
                    root: 'border-red-600 px-3 py-1 text-sm',
                  }}
                  onClick={() => setDeletionModal(true)}
                  data={{ cy: `delete-live-quiz-${quiz.name}` }}
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
            {quiz.blocks?.map((block, index) => (
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
                  {block.elements?.map((instance) => (
                    <Link
                      href={`/questions/${instance.elementData!.elementId}`}
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
                            {instance.elementData?.name} (
                            {t(`shared.${instance.elementData!.type}.short`)})
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
                    number: block.elements?.length,
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
        elementName={quiz.name || ''}
        message={t('manage.sessions.liveQuizDeletionHint')}
        deleteElement={deleteLiveQuiz}
        open={deletionModal}
        setOpen={setDeletionModal}
        primaryData={{ cy: 'confirm-delete-live-quiz' }}
        secondaryData={{ cy: 'cancel-delete-live-quiz' }}
      />
      <LiveQuizNameChangeModal
        quizId={quiz.id}
        name={quiz.name}
        displayName={quiz.displayName}
        open={changeName}
        setOpen={setChangeName}
      />
    </>
  )
}

export default LiveQuiz
