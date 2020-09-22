import React, { useState } from 'react'
import dayjs from 'dayjs'
import { useQuery } from '@apollo/react-hooks'
import { Loader, Message } from 'semantic-ui-react'

import CustomizableTable from '../common/CustomizableTable'
import RunningSessionListQuery from '../../graphql/queries/RunningSessionListQuery.graphql'
import { buildIndex, filterByTitle } from '../../lib/utils/filters'


interface Props {
    filters: any
}

function RunningSessionList({ filters } : Props) : React.ReactElement {

    const [isAbortConfirmationActive, setIsAbortConfirmationActive] = useState(false)

    const { data, loading, error} = useQuery(RunningSessionListQuery)

    const convertAttributeValues = (sessions: any[]): any => {
        const convertedSessionList = []
        sessions.forEach((session) => {
          const convertedSession = { ...session }
          convertedSession.startedAt = dayjs(session.startedAt).format('YYYY-MM-DD HH:mm')
          convertedSessionList.push(convertedSession)
        })
        return convertedSessionList
      }

    const onAbortSession = () : Promise<void> => {

    }
    const { sessions } = data

    // create a session index 
    const sessionIndex = buildIndex('runningSessions', sessions, ['id', 'startedAt', 'user.email'])  // user.email does not work by now

    // apply the filters
    const filteredSessions = filterByTitle(sessions, filters, sessionIndex)

    const matchingSessions = convertAttributeValues(filteredSessions)

    const tableColumns = [
        {
            title: 'Session-ID',
            attributeName: 'id',
            width: 4,
        }, 
        {
            title: 'User Email',
            attributeName: "user.email",
            width: 3,
        },
        {
            title: 'Running since',
            attributeName: 'startedAt',
            width: 3,
        }
    ]

    if (loading) {
        return <Loader active />
      }

    if (error) {
    return <Message error>{error.message}</Message>
    }

    return (
        <div className="sessionList">
            <CustomizableTable 
                hasAbort
                columns={tableColumns}
                data={matchingSessions}
                deletionConfirmation={isAbortConfirmationActive}
                handleDeletion={onAbortSession}
            />
        </div>
    )
}

export default RunningSessionList