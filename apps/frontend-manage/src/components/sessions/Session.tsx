import { useMutation } from '@apollo/client'
import LiveSessionDeletionModal from '@components/courses/modals/LiveSessionDeletionModal'
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
  GetRunningSessionsDocument,
  GetUserSessionsDocument,
  Session as SessionType,
  SessionBlock,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Collapsible, H3, ThemeContext } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import {
  QUESTION_TYPES_SHORT,
  SESSION_STATUS,
} from 'shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import EmbeddingModal from './EmbeddingModal'

interface SessionProps {
  session: SessionType
}

function Session({ session }: SessionProps) {
  const theme = useContext(ThemeContext)
  const [startSession] = useMutation(StartSessionDocument, {
    variables: { id: session.id },
    refetchQueries: [
      {
        query: GetRunningSessionsDocument,
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
      <div key={session.id} className="p-2 border rounded" data-cy="session">
        <Collapsible
          className={{ root: 'border-0' }}
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
                        root: twMerge(
                          'flex flex-row items-center gap-2 text-sm cursor-pointer',
                          theme.primaryTextHover
                        ),
                      }}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faCode} size="sm" />
                      </Button.Icon>
                      <Button.Label>Einbettung Evaluation</Button.Label>
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

                {SESSION_STATUS.RUNNING === session.status && (
                  <Link href={`/sessions/${session.id}/cockpit`} legacyBehavior>
                    <div
                      className={twMerge(
                        'flex flex-row items-center gap-2 text-sm cursor-pointer',
                        theme.primaryTextHover
                      )}
                      data-cy="session-cockpit"
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      <div>Dozierenden Cockpit</div>
                    </div>
                  </Link>
                )}
                {SESSION_STATUS.COMPLETED === session.status && (
                  <Link
                    href={`/sessions/${session.id}/evaluation`}
                    legacyBehavior
                  >
                    <div
                      className={twMerge(
                        'flex flex-row items-center gap-2 text-sm cursor-pointer',
                        theme.primaryTextHover
                      )}
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      <div>Session Evaluation</div>
                    </div>
                  </Link>
                )}
                {(SESSION_STATUS.PREPARED === session.status ||
                  SESSION_STATUS.SCHEDULED === session.status) && (
                  <Button
                    basic
                    onClick={async () => {
                      await startSession()
                      router.push(`sessions/${session.id}/cockpit`)
                    }}
                    data={{ cy: 'start-session' }}
                  >
                    <div
                      className={twMerge(
                        'flex flex-row items-center gap-2 text-sm cursor-pointer',
                        theme.primaryTextHover
                      )}
                    >
                      <FontAwesomeIcon icon={faPlay} size="sm" />
                      <div>Start Session</div>
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
              {session.numOfBlocks} Blöcke, {session.numOfQuestions} Fragen
            </div>
          }
        >
          <div className="flex flex-row gap-2 my-2 overflow-y-scroll">
            {session.blocks?.map((block, index) => (
              <div key={block.id} className="flex flex-col gap-2">
                <div className="italic">
                  Block {index + 1} ({block.instances.length} Fragen)
                </div>
                {block.instances.map((instance) => (
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
                        ({QUESTION_TYPES_SHORT[instance.questionData.type]})
                      </div>
                    </div>
                    <Ellipsis maxLength={50} className={{ markdown: 'px-1' }}>
                      {instance.questionData.content}
                    </Ellipsis>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Collapsible>
        {(SESSION_STATUS.PREPARED === session.status ||
          SESSION_STATUS.SCHEDULED === session.status) && (
          <div className="flex flex-row float-right gap-1">
            <Button
              className={{ root: 'text-sm py-1 px-3' }}
              onClick={() =>
                router.push({
                  pathname: '/',
                  query: { sessionId: session.id, editMode: 'liveSession' },
                })
              }
            >
              <Button.Icon className={{ root: 'text-slate-600' }}>
                <FontAwesomeIcon icon={faPencil} />
              </Button.Icon>
              <Button.Label>Session bearbeiten</Button.Label>
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
              <Button.Label>Session löschen</Button.Label>
            </Button>
          </div>
        )}
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
