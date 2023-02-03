import { useMutation, useQuery } from '@apollo/client'
import {
  ActivateSessionBlockDocument,
  DeactivateSessionBlockDocument,
  EndSessionDocument,
  GetControlSessionDocument,
  GetRunningSessionsDocument,
  Session,
  SessionBlockStatus,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H3,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../components/Layout'
import SessionBlock from '../../components/sessions/SessionBlock'

function RunningSession() {
  const router = useRouter()
  const theme = useContext(ThemeContext)
  const [nextBlock, setNextBlock] = useState(-1)
  const [currentBlock, setCurrentBlock] = useState<number | undefined>(
    undefined
  )

  const [activateSessionBlock] = useMutation(ActivateSessionBlockDocument)
  const [deactivateSessionBlock] = useMutation(DeactivateSessionBlockDocument)
  const [endSession] = useMutation(EndSessionDocument, {
    refetchQueries: [
      {
        query: GetRunningSessionsDocument,
      },
    ],
  })
  const {
    loading: sessionLoading,
    error: sessionError,
    data: sessionData,
  } = useQuery(GetControlSessionDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 1000,
    skip: !router.query.id,
  })

  useEffect(() => {
    if (!sessionData?.controlSession?.activeBlock) {
      setCurrentBlock(undefined)
      return
    }
    setCurrentBlock(sessionData?.controlSession?.activeBlock.id)
  }, [sessionData?.controlSession?.activeBlock])

  useEffect(() => {
    if (!sessionData?.controlSession?.blocks) return
    const scheduledNext = sessionData?.controlSession?.blocks.findIndex(
      (block) => block.status === SessionBlockStatus.Scheduled
    )
    setNextBlock(typeof scheduledNext === 'undefined' ? -1 : scheduledNext)
    console.log(scheduledNext)
  }, [sessionData?.controlSession?.blocks])

  if (sessionLoading) {
    return <Layout title="Session-Steuerung">Loading...</Layout>
  }
  if (!sessionData?.controlSession || sessionError) {
    return (
      <Layout title="Session-Steuerung">
        <UserNotification
          message="Leider ist beim Laden der Session ein Fehler aufgetreten. Bitte vergewissern Sie sich, dass die Session noch läuft oder versuchen Sie es später nochmals"
          notificationType="error"
        />
      </Layout>
    )
  }

  const { id, name, course, activeBlock, blocks } =
    sessionData?.controlSession as Session

  if (!blocks) {
    return (
      <Layout title={name}>
        <UserNotification
          notificationType="warning"
          message="Diese Session enthält keine Fragen und kann daher zum aktuellen Zeitpunkt nicht über die Controller-App gesteuert werden. Bitte benutzen sie die Manage-App mit allen Funktionalitäten."
        />
      </Layout>
    )
  }

  return (
    <Layout title={`Session: ${name}`} sessionId={id}>
      <div key={`${currentBlock}-${nextBlock}`}>
        {currentBlock ? (
          <div key={`${currentBlock}-${nextBlock}`}>
            <H3>Aktiver Block:</H3>

            <SessionBlock
              block={blocks.find((block) => block.id === currentBlock)}
            />
            <Button
              onClick={async () => {
                await deactivateSessionBlock({
                  variables: {
                    sessionId: id,
                    sessionBlockId: currentBlock,
                  },
                })
                setCurrentBlock(undefined)
              }}
              className={{
                root: 'float-right',
              }}
            >
              Block schliessen
            </Button>
          </div>
        ) : nextBlock !== -1 ? (
          <div>
            <H3>Nächster Block:</H3>
            <SessionBlock block={blocks[nextBlock]} />
            <Button
              onClick={async () => {
                {
                  await activateSessionBlock({
                    variables: {
                      sessionId: id,
                      sessionBlockId: blocks[nextBlock].id,
                    },
                  })
                  setCurrentBlock(blocks[nextBlock].id)
                }
              }}
              className={{
                root: twMerge('float-right text-white', theme.primaryBgDark),
              }}
            >
              Block {nextBlock + 1} aktivieren
            </Button>
          </div>
        ) : (
          <div>
            <UserNotification
              notificationType="info"
              message="Es wurden bereits alle Blöcke dieser Session ausgeführt und geschlossen. Mit dem Beenden der Session wird auch der Feedback-Kanal geschlossen."
              className={{ root: 'mb-2' }}
            />
            <Button
              onClick={async () => {
                await endSession({ variables: { id: id } })
                router.push(
                  course ? `/course/${course?.id}` : '/course/unassigned'
                )
              }}
              className={{
                root: 'float-right text-white bg-uzh-red-100',
              }}
            >
              Session beenden
            </Button>
          </div>
        )}

        {currentBlock && nextBlock !== -1 && nextBlock !== blocks.length && (
          <div className="mt-14">
            <H3>Nächster Block:</H3>

            <SessionBlock
              block={blocks.find((block) => block.order === nextBlock)}
            />
          </div>
        )}
        {currentBlock && nextBlock == -1 && (
          <UserNotification
            message="Der aktuell laufende Block is der letzte dieser Session. Nach Schliessen dieses Blockes kann die Session beendet werden."
            className={{ root: 'mt-14' }}
          />
        )}
      </div>
    </Layout>
  )
}

export default RunningSession
