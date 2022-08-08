import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import React, { useEffect } from 'react'

import SessionDetailsQuery from '../../../graphql/queries/SessionDetailsQuery.graphql'

import SessionCreationForm from './SessionCreationForm'
import { AuthenticationMode } from './SessionParticipantSettings'

interface EditFormProps {
  sessionBlocks: any[]
  handleSetSessionBlocks: any
  sessionName: string
  isAuthenticationEnabled: boolean
  sessionParticipants: any[]
  handleSetSessionName: any
  handleSetSessionParticipants: any
  handleSetIsAuthenticationEnabled: any
  runningSessionId: string
  handleCreateSession: any
  sessionAuthenticationMode: AuthenticationMode
  handleSetSessionAuthenticationMode: any
  setSessionName: any
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
  sessionParticipants,
  isAuthenticationEnabled,
  sessionAuthenticationMode,
  handleSetIsAuthenticationEnabled,
  handleSetSessionName,
  handleSetSessionParticipants,
  runningSessionId,
  handleCreateSession,
  handleSetSessionAuthenticationMode,
  setSessionName,
}: EditFormProps): React.ReactElement {
  const router = useRouter()

  const { loading, data } = useQuery(SessionDetailsQuery, {
    variables: { id: router.query.editSessionId },
  })

  useEffect((): void => {
    if (!data || !data.session) {
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
  }, [router.query.editSessionId, data])

  if (loading || !data.session) {
    return null
  }

  return (
    <SessionCreationForm
      handleCreateSession={handleCreateSession}
      handleSetIsAuthenticationEnabled={handleSetIsAuthenticationEnabled}
      handleSetSessionAuthenticationMode={handleSetSessionAuthenticationMode}
      handleSetSessionBlocks={handleSetSessionBlocks}
      handleSetSessionName={handleSetSessionName}
      handleSetSessionParticipants={handleSetSessionParticipants}
      isAuthenticationEnabled={isAuthenticationEnabled}
      runningSessionId={runningSessionId}
      sessionAuthenticationMode={sessionAuthenticationMode}
      sessionBlocks={sessionBlocks}
      sessionInteractionType={getInteractionType(data.session.id, router.query.copy)}
      sessionName={sessionName}
      sessionParticipants={sessionParticipants}
      setSessionName={setSessionName}
    />
  )
}

export default SessionEditForm
