import { useMutation } from '@apollo/client'
import {
  faCalendarDays,
  faChevronDown,
  faChevronUp,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetRunningSessionsDocument,
  Session as SessionType,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import * as RadixCollapsible from '@radix-ui/react-collapsible'
import { Button, H2, H4 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { SESSION_STATUS } from 'shared-components/src/constants'

interface SessionProps {
  sessionName: string
  sessionList: SessionType[]
}

// TODO: move collapsible / collapsible list with to design system
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
            <RadixCollapsible.Root
              open={showDetails && session.id === selectedSession}
              onOpenChange={() => {
                if (session.id === selectedSession) {
                  setShowDetails(!showDetails)
                } else {
                  setShowDetails(true)
                  setSelectedSession(session.id)
                }
              }}
            >
              <div className="w-full p-2 pb-0 border-2 border-solid rounded-md border-uzh-grey-80">
                <div className="flex flex-row justify-between">
                  <H4 className="mb-0">{session.name}</H4>
                  <div className="flex flex-row gap-5">
                    {SESSION_STATUS.RUNNING === session.status && (
                      <div className="text-sm">Link to Cockpit</div>
                    )}
                    {SESSION_STATUS.COMPLETED === session.status && (
                      <div className="text-sm">Link to Evaluation</div>
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
                <div className="italic">
                  {session.numOfBlocks} Blöcke, {session.numOfQuestions} Fragen
                </div>
                <RadixCollapsible.Content>
                  <div>CONTENT - QUESTIONS</div>
                </RadixCollapsible.Content>
                <RadixCollapsible.Trigger className="w-full text-center">
                  <FontAwesomeIcon
                    icon={
                      showDetails && session.id === selectedSession
                        ? faChevronUp
                        : faChevronDown
                    }
                    size="sm"
                  />
                </RadixCollapsible.Trigger>
              </div>
            </RadixCollapsible.Root>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Session
