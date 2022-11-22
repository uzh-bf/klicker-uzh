import {
  faCalendarDays,
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session as SessionType } from '@klicker-uzh/graphql/dist/ops'
import * as RadixCollapsible from '@radix-ui/react-collapsible'
import { H2, H4 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useState } from 'react'

interface SessionProps {
  sessionName: string
  sessionList: SessionType[]
}

// TODO: move collapsible / collapsible list with to design system
function Session({ sessionName, sessionList }: SessionProps) {
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [selectedSession, setSelectedSession] = useState<string>('')

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
                  <div className="flex flex-row gap-3">
                    <div className="text-sm">Start / Running / Evaluation</div>
                    <div className="text-sm">
                      <FontAwesomeIcon icon={faCalendarDays} className="mr-1" />
                      {dayjs(session.createdAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                </div>
                <div className="italic">{session.numOfBlocks} Blöcke, {session.numOfQuestions} Fragen</div>
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
