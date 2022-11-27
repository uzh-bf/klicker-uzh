import { useMutation } from '@apollo/client'
import { faCalendarDays, faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetRunningSessionsDocument,
  QuestionInstance,
  Session as SessionType,
  SessionBlock,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H4 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'

import { QUESTION_TYPES_SHORT } from 'shared-components/src/constants'

interface SessionProps {
  sessionName: string
  sessionList: SessionType[]
}

const defaultProps = {}

function Session({
  sessionName,
  sessionList,
}: SessionProps): React.ReactElement {
  const [startSession] = useMutation(StartSessionDocument)
  const router = useRouter()

  return (
    <div>
      <H2 className="mb-2">{sessionName}</H2>
      <div className="mb-8">
        {sessionList.map((session: SessionType) => (
          <div key={session.id} className="mb-4">
            <div className="flex flex-row items-end border-b border-solid border-uzh-grey-40">
              <H4 className="flex-1">{session.displayName}</H4>
              {(session.status === 'RUNNING' ||
                session.status === 'COMPLETED') && (
                <Link
                  href={`/sessions/${session.id}/evaluation`}
                  passHref
                  className="mr-4 text-sm hover:text-uzh-red-100"
                >
                  Zur Evaluation
                </Link>
              )}
              <div className="text-sm">
                <FontAwesomeIcon icon={faCalendarDays} className="mr-1" />
                {dayjs(session.createdAt).format('YYYY-MM-DD HH:mm')}
              </div>
            </div>
            <div className="flex flex-row">
              <div className="flex flex-row flex-1">
                {session.blocks?.map((block: SessionBlock, index: number) => (
                  <div className="max-h-80" key={block.id}>
                    <div className="mb-1 ml-1 text-sm">Block {index}</div>
                    {block.instances.map((instance: QuestionInstance) => (
                      <div
                        key={instance.id}
                        className="flex flex-row p-0.5 border border-solid border-uzh-grey-60 rounded-md m-0.5 text-sm w-40"
                      >
                        <div>
                          {instance.questionData.name} (
                          {QUESTION_TYPES_SHORT[instance.questionData.type]})
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {session.status !== 'RUNNING' &&
                session.status !== 'COMPLETED' && (
                  <Button
                    className="px-2 mt-1 text-sm h-9 border-uzh-grey-80"
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
                    <Button.Icon>
                      <FontAwesomeIcon icon={faPlay} className="mr-1" />
                    </Button.Icon>
                    <Button.Label>Start Session</Button.Label>
                  </Button>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

Session.defaultProps = defaultProps

export default Session
