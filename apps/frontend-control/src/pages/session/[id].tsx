import { useMutation, useQuery } from '@apollo/client'
import { faArrowDown, faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivateSessionBlockDocument,
  DeactivateSessionBlockDocument,
  EndSessionDocument,
  GetControlSessionDocument,
  GetUserRunningSessionsDocument,
  SessionBlockStatus,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H3,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import * as R from 'ramda'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../components/Layout'
import SessionBlock from '../../components/sessions/SessionBlock'

function RunningSession() {
  const t = useTranslations()
  const router = useRouter()
  const theme = useContext(ThemeContext)
  const [nextBlockOrder, setNextBlockOrder] = useState(-1)
  const [currentBlockOrder, setCurrentBlockOrder] = useState<
    number | undefined
  >(undefined)
  const [activateSessionBlock] = useMutation(ActivateSessionBlockDocument)
  const [deactivateSessionBlock] = useMutation(DeactivateSessionBlockDocument)
  const [endSession] = useMutation(EndSessionDocument, {
    refetchQueries: [{ query: GetUserRunningSessionsDocument }],
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
    return (
      <Layout title={t('control.session.sessionControl')}>
        {t('shared.generic.loading')}
      </Layout>
    )
  }

  if (!sessionData?.controlSession || sessionError) {
    return (
      <Layout title={t('control.session.sessionControl')}>
        <UserNotification
          message={t('control.session.errorLoadingSession')}
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
          message={t('control.session.containsNoQuestions')}
        />
      </Layout>
    )
  }

  return (
    <Layout
      title={t('control.session.sessionWithName', { name: name })}
      sessionId={id}
    >
      <div key={`${currentBlockOrder}-${nextBlockOrder}`}>
        {typeof currentBlockOrder !== 'undefined' ? (
          <div key={`${currentBlockOrder}-${nextBlockOrder}-child`}>
            <H3>{t('control.session.activeBlock')}</H3>

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
              data={{ cy: 'deactivate-block' }}
            >
              {t('control.session.closeBlock')}
            </Button>
          </div>
        ) : nextBlockOrder !== -1 ? (
          <div>
            <H3>{t('control.session.nextBlock')}</H3>
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
              data={{ cy: 'activate-next-block' }}
            >
              {t('control.session.activateBlockN', {
                number: nextBlockOrder + 1,
              })}
            </Button>
          </div>
        ) : (
          <div>
            <UserNotification
              type="info"
              message={t('control.session.hintAllBlocksClosed')}
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
              data={{ cy: 'end-session' }}
            >
              {t('control.session.endSession')}
            </Button>
          </div>
        )}

        {typeof currentBlockOrder !== 'undefined' && nextBlockOrder == -1 && (
          <UserNotification
            message={t('control.session.hintLastBlock')}
            className={{ root: 'mt-14' }}
          />
        )}
      </div>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default RunningSession
