import { useMutation } from '@apollo/client'
import Ellipsis from '@components/common/Ellipsis'
import {
  faArrowUpRightFromSquare,
  faCalendarDays,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetRunningSessionsDocument,
  Session as SessionType,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Collapsible, H2, H3 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import {
  QUESTION_TYPES_SHORT,
  SESSION_STATUS,
} from 'shared-components/src/constants'

interface SessionProps {
  sessionName: string
  sessionList: SessionType[]
}

function Session({ sessionName, sessionList }: SessionProps) {
  const [startSession] = useMutation(StartSessionDocument)

  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [selectedSession, setSelectedSession] = useState<string>('')
  const router = useRouter()

  return (
    <div>
      <H2>{sessionName}</H2>
      <div className="flex flex-col gap-2">
        {sessionList.map((session) => (
          <div key={session.id}>
            <Collapsible
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
                <div className="flex flex-row justify-between">
                  <H3 className="mb-0">{session.name}</H3>
                  <div className="flex flex-row gap-5">
                    {SESSION_STATUS.RUNNING === session.status && (
                      <Link
                        href={`/sessions/${session.id}/cockpit`}
                        legacyBehavior
                      >
                        <div className="flex flex-row items-center gap-2 text-sm cursor-pointer hover:text-uzh-blue-100">
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
                        <div className="flex flex-row items-center gap-2 text-sm cursor-pointer hover:text-uzh-blue-100">
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
                          await startSession({
                            variables: { id: session.id },
                            refetchQueries: [
                              {
                                query: GetRunningSessionsDocument,
                              },
                            ],
                          })
                          router.push(`sessions/${session.id}/cockpit`)
                        }}
                      >
                        <div className="flex flex-row items-center gap-2 text-sm cursor-pointer hover:text-uzh-blue-100">
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

                          <div>
                            ({QUESTION_TYPES_SHORT[instance.questionData.type]})
                          </div>
                        </div>
                        <Ellipsis
                          maxLength={50}
                          className={{ markdown: 'px-1' }}
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
        ))}
      </div>
    </div>
  )
}

export default Session
