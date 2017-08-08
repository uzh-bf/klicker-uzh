// @flow

import React from 'react'
import { graphql } from 'react-apollo'

import Session from './Session'
import { SessionListQuery } from '../../queries/queries'
import type { SessionListType } from '../../queries/queries'

type Props = {
  data: SessionListType,
}

const SessionList = ({ data }: Props) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return (
      <div>
        {data.error}
      </div>
    )
  }

  return (
    <div>
      {data.sessions.map(session =>
        (<div className="session">
          <Session key={session.id} {...session} />
        </div>),
      )}

      <style jsx>{`
        .session {
          margin-bottom: 2rem;
        }
      `}</style>
    </div>
  )
}

export default graphql(SessionListQuery)(SessionList)
