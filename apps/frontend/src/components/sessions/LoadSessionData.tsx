import React from 'react'
import _get from 'lodash/get'
import { useQuery } from '@apollo/client'

import SessionEvaluationQuery from '../../graphql/queries/SessionEvaluationQuery.graphql'
import SessionEvaluationPublicQuery from '../../graphql/queries/SessionEvaluationPublicQuery.graphql'
import { SESSION_STATUS } from '../../constants'

interface Props {
  sessionId: string
  children: any
  isPublic: boolean
}

function LoadSessionData({ sessionId, children, isPublic }: Props): React.ReactElement {
  const session = useQuery(SessionEvaluationQuery, {
    skip: isPublic,
    variables: { sessionId },
  })

  const sessionWithRefetch = useQuery(SessionEvaluationQuery, {
    pollInterval: 5000,
    skip: isPublic || _get(session, 'data.session.status') !== SESSION_STATUS.RUNNING,
    variables: { sessionId },
  })

  const sessionPublic = useQuery(SessionEvaluationPublicQuery, {
    skip: !isPublic,
    variables: { sessionId },
  })

  // if the session is public, return only public data
  if (isPublic) {
    return children({ ...sessionPublic, session: _get(sessionPublic, 'data.sessionPublic') })
  }

  // if the session is running, return a refetching query
  if (_get(session, 'data.status') === SESSION_STATUS.RUNNING) {
    return children({ ...sessionWithRefetch, session: _get(sessionWithRefetch, 'data.session') })
  }

  // return the session without refetch per default
  return children({ ...session, session: _get(session, 'data.session') })
}

export default LoadSessionData
