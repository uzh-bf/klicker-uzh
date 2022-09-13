import { Session as SessionType } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import React from 'react'

interface SessionProps {
  sessionName: string
  sessionList: SessionType[]
}

const defaultProps = {}

function Session({
  sessionName,
  sessionList,
}: SessionProps): React.ReactElement {
  return (
    <div>
      <H2>{sessionName}</H2>
      <div className="mb-8">
        {sessionList.map((session: SessionType) => (
          <div key={session.id}>{session.name}</div>
        ))}
      </div>
    </div>
  )
}

Session.defaultProps = defaultProps

export default Session
