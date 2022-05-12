import React, { useState } from 'react'
import dayjs from 'dayjs'
import { useMutation, useQuery } from '@apollo/client'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { useToasts } from 'react-toast-notifications'

import CustomizableTable from '../common/CustomizableTable'
import AbortSessionMutation from '../../graphql/mutations/AbortSessionMutation.graphql'
import RunningSessionListQuery from '../../graphql/queries/RunningSessionListQuery.graphql'
import { buildIndex, filterByTitle } from '../../lib/utils/filters'

interface Props {
  filters: any
}

function RunningSessionList({ filters }: Props): React.ReactElement {
  const { addToast } = useToasts()

  const [isAbortConfirmationActive, setIsAbortConfirmationActive] = useState(false)

  const { data, loading, error } = useQuery(RunningSessionListQuery)
  const [abortSession] = useMutation(AbortSessionMutation)

  const convertAttributeValues = (sessions: any[]): any => {
    const convertedSessionList = []
    sessions.forEach((session) => {
      const convertedSession = { ...session }
      convertedSession.startedAt = dayjs(session.startedAt).format('YYYY-MM-DD HH:mm')
      convertedSessionList.push(convertedSession)
    })
    return convertedSessionList
  }

  const onAbortSession = async (sessionId: string, confirm: boolean): Promise<void> => {
    if (!isAbortConfirmationActive) {
      setIsAbortConfirmationActive(true)
      return
    }
    if (confirm) {
      try {
        await abortSession({
          refetchQueries: [{ query: RunningSessionListQuery }],
          variables: { id: sessionId },
        })
        addToast(
          <FormattedMessage
            defaultMessage="Session successfully aborted."
            id="components.admin.sessionlist.abort.success"
          />,
          {
            appearance: 'success',
          }
        )
      } catch ({ message }) {
        addToast(
          <FormattedMessage
            defaultMessage="Unable to delete user: {errorMessage}"
            id="components.admin.userList.delete.error"
            values={{ errorMessage: message }}
          />,
          {
            appearance: 'error',
          }
        )
      }
    }
    setIsAbortConfirmationActive(false)
  }

  if (loading) {
    return <Loader active />
  }

  if (error) {
    return <Message error>{error.message}</Message>
  }

  const { sessions } = data

  // create a session index
  const sessionIndex = buildIndex('runningSessions', sessions, ['id', 'startedAt', 'user.email']) // user.email does not work by now

  // apply the filters
  const filteredSessions = filterByTitle(sessions, filters, sessionIndex)

  const matchingSessions = convertAttributeValues(filteredSessions)

  if (matchingSessions.length === 0) {
    return (
      <div className="sessionList">
        <FormattedMessage
          defaultMessage="No matching running session was found."
          id="admin.AdminArea.SessionManagement.noSession"
        />
      </div>
    )
  }

  const tableColumns = [
    {
      title: 'Session-ID',
      attributeName: 'id',
      width: 4,
    },
    {
      title: 'User Email',
      attributeName: 'user.email',
      width: 3,
    },
    {
      title: 'Running since',
      attributeName: 'startedAt',
      width: 3,
    },
  ]

  return (
    <div className="sessionList">
      <CustomizableTable
        hasAbort
        abortConfirmation={isAbortConfirmationActive}
        columns={tableColumns}
        data={matchingSessions}
        handleAbort={onAbortSession}
      />
    </div>
  )
}

export default RunningSessionList
