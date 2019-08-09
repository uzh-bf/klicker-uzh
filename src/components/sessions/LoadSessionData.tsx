import React from 'react'
import _get from 'lodash/get'
import { useQuery } from 'react-apollo'

import { SessionEvaluationQuery, SessionEvaluationPublicQuery } from '../../graphql'
import { SESSION_STATUS } from '../../lib'

interface Props {
  sessionId: string
  children: Function
  isPublic: boolean
}

function LoadSessionData({ sessionId, children, isPublic }: Props): React.ReactElement {
  const session = useQuery(SessionEvaluationQuery, {
    skip: isPublic,
    variables: { sessionId },
  })

  const sessionWithRefetch = useQuery(SessionEvaluationQuery, {
    pollInterval: 7000,
    skip: isPublic || _get(session, 'data.status') !== SESSION_STATUS.RUNNING,
    variables: { sessionId },
  })

  const sessionPublic = useQuery(SessionEvaluationPublicQuery, {
    skip: !isPublic,
    variables: { sessionId },
  })

  // if the session is public, return only public data
  if (isPublic) {
    return children(sessionPublic)
  }

  // if the session is running, return a refetching query
  if (_get(session, 'data.status') === SESSION_STATUS.RUNNING) {
    return children(sessionWithRefetch)
  }

  // return the session without refetch per default
  return children(session)
}

export default LoadSessionData
