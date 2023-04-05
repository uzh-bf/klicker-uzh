import { useMutation, useQuery } from '@apollo/client'
import { faArrowDown, faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivateSessionBlockDocument,
  DeactivateSessionBlockDocument,
  EndSessionDocument,
  GetControlSessionDocument,
  GetRunningSessionsDocument,
  SessionBlockStatus,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H3,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import * as R from 'ramda'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../components/Layout'
import SessionBlock from '../../components/sessions/SessionBlock'

function RunningSession() {
  const router = useRouter()
  const theme = useContext(ThemeContext)
  const [nextBlockOrder, setNextBlockOrder] = useState(-1)
  const [currentBlockOrder, setCurrentBlockOrder] = useState<
    number | undefined
  >(undefined)
  const [activateSessionBlock] = useMutation(ActivateSessionBlockDocument)
  const [deactivateSessionBlock] = useMutation(DeactivateSessionBlockDocument)
  const [endSession] = useMutation(EndSessionDocument, {
    refetchQueries: [{ query: GetRunningSessionsDocument }],
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
    setCurrentBlockOrder(sessionData?.controlSession?.activeBlock?.order)
  }, [
    sessionData?.controlSession?.id,
    sessionData?.controlSession?.activeBlock,
  ])

  useEffect(() => {
    if (!sessionData?.controlSession?.blocks) return

    const sortedBlocks = R.sort(
      (a, b) => a.order - b.order,
      sessionData?.controlSession?.blocks
    )

    if (!sortedBlocks) return
    const scheduledNext = sortedBlocks.find(
      (block) => block.status === SessionBlockStatus.Scheduled
    )
    setNextBlockOrder(
      typeof scheduledNext === 'undefined' ? -1 : scheduledNext.order
    )
  }, [sessionData?.controlSession?.blocks])

  if (sessionLoading) {
    return <Layout title="Session-Steuerung">Loading...</Layout>
  }

  if (!sessionData?.controlSession || sessionError) {
    return (
      <Layout title="Session-Steuerung">
        <UserNotification
          message="Leider ist beim Laden der Session ein Fehler aufgetreten. Bitte vergewissern Sie sich, dass die Session noch läuft oder versuchen Sie es später nochmals"
          type="error"
        />
      </Layout>
    )
  }

  const { id, name, course, blocks } = sessionData?.controlSession

  if (!blocks) {
    return (
      <Layout title={name}>
        <UserNotification
          type="warning"
          message="Diese Session enthält keine Fragen und kann daher zum aktuellen Zeitpunkt nicht über die Controller-App gesteuert werden. Bitte benutzen sie die Manage-App mit allen Funktionalitäten."
        />
      </Layout>
    )
  }

  return (
    <Layout title={`Session: ${name}`} sessionId={id}>
      <div key={`${currentBlockOrder}-${nextBlockOrder}`}>
        {typeof currentBlockOrder !== 'undefined' ? (
          <div key={`${currentBlockOrder}-${nextBlockOrder}-child`}>
            <H3>Aktiver Block:</H3>

            <SessionBlock
              block={blocks.find((block) => block.order === currentBlockOrder)}
              active
            />
            {typeof currentBlockOrder !== 'undefined' &&
              nextBlockOrder !== -1 &&
              nextBlockOrder < blocks.length && (
                <div className="flex flex-col gap-2 mt-2">
                  <FontAwesomeIcon
                    icon={faArrowDown}
                    className="w-full mx-auto"
                    size="2xl"
                  />

                  <SessionBlock
                    block={blocks.find(
                      (block) => block.order === nextBlockOrder
                    )}
                  />
                </div>
              )}
            <Button
              onClick={async () => {
                await deactivateSessionBlock({
                  variables: {
                    sessionId: id,
                    sessionBlockId:
                      blocks.find((block) => block.order === currentBlockOrder)
                        ?.id || -1,
                  },
                })
                setCurrentBlockOrder(undefined)
              }}
              className={{
                root: 'float-right',
              }}
            >
              Block schliessen
            </Button>
          </div>
        ) : nextBlockOrder !== -1 ? (
          <div>
            <H3>Nächster Block:</H3>
            {nextBlockOrder > 0 && (
              <FontAwesomeIcon
                icon={faEllipsis}
                size="2xl"
                className="w-full mx-auto"
              />
            )}
            <SessionBlock
              block={blocks.find((block) => block.order === nextBlockOrder)}
            />
            {nextBlockOrder < blocks.length - 1 && (
              <FontAwesomeIcon
                icon={faEllipsis}
                size="2xl"
                className="w-full mx-auto"
              />
            )}
            <Button
              onClick={async () => {
                {
                  await activateSessionBlock({
                    variables: {
                      sessionId: id,
                      sessionBlockId:
                        blocks.find((block) => block.order === nextBlockOrder)
                          ?.id || -1,
                    },
                  })
                  setCurrentBlockOrder(nextBlockOrder)
                  setNextBlockOrder(nextBlockOrder + 1)
                }
              }}
              className={{
                root: twMerge('float-right text-white', theme.primaryBgDark),
              }}
            >
              Block {nextBlockOrder + 1} aktivieren
            </Button>
          </div>
        ) : (
          <div>
            <UserNotification
              type="info"
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

        {typeof currentBlockOrder !== 'undefined' && nextBlockOrder == -1 && (
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
