import { useMutation } from '@apollo/client'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpRightFromSquare,
  faCalendarDays,
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
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Collapsible, H3 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import LiveSessionDeletionModal from '../courses/modals/LiveSessionDeletionModal'
import EmbeddingModal from './EmbeddingModal'

interface SessionProps {
  session: SessionType
}

function Session({ session }: SessionProps) {
  const t = useTranslations()
  const [startSession] = useMutation(StartSessionDocument, {
    variables: { id: session.id },
    refetchQueries: [
      {
        query: GetUserRunningSessionsDocument,
      },
    ],
  })
  const [deleteSession] = useMutation(DeleteSessionDocument, {
    variables: { id: session.id || '' },
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

  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)
  const [deletionModal, setDeletionModal] = useState<boolean>(false)

  const router = useRouter()

  return (
    <>
      <div key={session.id} className="p-1 border rounded" data-cy="session">
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
              <H3 className={{ root: 'mb-0' }}>{session.name}</H3>
              <div className="flex flex-row gap-5">
                {session.blocks?.length !== 0 && (
                  <>
                    <Button
                      basic
                      onClick={() => setEmbedModalOpen(true)}
                      className={{
                        root: 'flex flex-row items-center gap-2 text-sm cursor-pointer sm:hover:text-primary',
                      }}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faCode} size="sm" />
                      </Button.Icon>
                      <Button.Label>
                        {t('manage.sessions.embeddingEvaluation')}
                      </Button.Label>
                    </Button>
                    <EmbeddingModal
                      key={session.id}
                      open={embedModalOpen}
                      onClose={() => setEmbedModalOpen(false)}
                      sessionId={session.id}
                      questions={session.blocks?.flatMap(
                        (block: SessionBlock) => block.instances
                      )}
                    />
                  </>
                )}

                {SessionStatus.Running === session.status && (
                  <Link href={`/sessions/${session.id}/cockpit`} legacyBehavior>
                    <div
                      className="flex flex-row items-center gap-2 text-sm cursor-pointer sm:hover:text-primary"
                      data-cy="session-cockpit"
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      <div>{t('manage.sessions.lecturerCockpit')}</div>
                    </div>
                  </Link>
                )}
                {SessionStatus.Completed === session.status && (
                  <Link
                    href={`/sessions/${session.id}/evaluation`}
                    legacyBehavior
                  >
                    <div className="flex flex-row items-center gap-2 text-sm cursor-pointer sm:hover:text-primary">
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      <div>{t('manage.sessions.sessionEvaluation')}</div>
                    </div>
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
                    data={{ cy: 'start-session' }}
                  >
                    <div className="flex flex-row items-center gap-2 text-sm cursor-pointer sm:hover:text-primary">
                      <FontAwesomeIcon icon={faPlay} size="sm" />
                      <div>{t('manage.sessions.startSession')}</div>
                    </div>
                  </Button>
                )}
                <div className="flex flex-row items-center text-sm">
                  <FontAwesomeIcon icon={faCalendarDays} className="mr-1" />
                  {dayjs(session.createdAt).format('YYYY-MM-DD HH:mm')}
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
            <div className="flex flex-row float-right gap-1">
              <Button
                className={{ root: 'text-sm py-1 px-3' }}
                onClick={() =>
                  router.push({
                    pathname: '/',
                    query: {
                      sessionId: session.id,
                      duplicationMode: 'liveSession',
                    },
                  })
                }
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
                    className={{ root: 'text-sm py-1 px-3' }}
                    onClick={() =>
                      router.push({
                        pathname: '/',
                        query: {
                          sessionId: session.id,
                          editMode: 'liveSession',
                        },
                      })
                    }
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
                      root: 'border-red-600 text-sm py-1 px-3',
                    }}
                    onClick={() => setDeletionModal(true)}
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
            </div>
          }
        >
          <div className="flex flex-row gap-2 my-2 overflow-y-scroll">
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
                    className="text-sm border border-solid rounded-md w-60 border-uzh-grey-100"
                  >
                    <div className="flex flex-row justify-between bg-uzh-grey-40 px-1 py-0.5">
                      <Ellipsis
                        className={{ markdown: 'font-bold' }}
                        maxLength={20}
                      >
                        {instance.questionData.name}
                      </Ellipsis>

                      <div className="italic">
                        ({t(`shared.${instance.questionData.type}.short`)})
                      </div>
                    </div>
                    <Ellipsis
                      maxLength={50}
                      className={{ markdown: 'px-1 text-sm' }}
                    >
                      {instance.questionData.content}
                    </Ellipsis>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Collapsible>
      </div>
      <LiveSessionDeletionModal
        deleteSession={deleteSession}
        title={session.name}
        open={deletionModal}
        setOpen={setDeletionModal}
      />
    </>
  )
}

export default Session
