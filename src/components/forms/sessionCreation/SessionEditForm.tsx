import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@apollo/react-hooks'

import SessionDetailsQuery from '../../../graphql/queries/SessionDetailsQuery.graphql'

import SessionCreationForm from './SessionCreationForm'

interface EditFormProps {
  sessionBlocks: any[]
  handleSetSessionBlocks: any
  sessionName: string
  handleSetSessionName: any
  runningSessionId: string
  handleCreateSession: any
  handleCreationModeToggle: any
}

function getInteractionType(sessionId, copyMode): 'CREATE' | 'COPY' | 'MODIFY' {
  if (sessionId) {
    if (copyMode) {
      return 'COPY'
    }
    return 'MODIFY'
  }
  return 'CREATE'
}

function SessionEditForm({
  sessionBlocks,
  handleSetSessionBlocks,
  sessionName,
  handleSetSessionName,
  runningSessionId,
  handleCreateSession,
  handleCreationModeToggle,
}: EditFormProps): React.ReactElement {
  const router = useRouter()

  const { loading, data } = useQuery(SessionDetailsQuery, {
    variables: { id: router.query.editSessionId },
  })

  useEffect((): void => {
    if (!data.session) {
      return
    }

    handleSetSessionName(router.query.copy ? `${data.session.name} Copy` : data.session.name)

    handleSetSessionBlocks(
      data.session.blocks.map(({ id, instances }): any => ({
        id,
        key: id,
        questions: instances.map(({ question, version }): any => ({
          id: question.id,
          title: question.title,
          type: question.type,
          version,
        })),
      }))
    )
  }, [router.query.editSessionId])

  if (loading || !data.session) {
    return null
  }

  return (
    <SessionCreationForm
      handleCreateSession={handleCreateSession}
      handleCreationModeToggle={handleCreationModeToggle}
      handleSetSessionBlocks={handleSetSessionBlocks}
      handleSetSessionName={handleSetSessionName}
      runningSessionId={runningSessionId}
      sessionBlocks={sessionBlocks}
      sessionInteractionType={getInteractionType(data.session.id, router.query.copy)}
      sessionName={sessionName}
    />
  )
}

export default SessionEditForm
