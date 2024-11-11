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
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { sort } from 'remeda'
import Layout from '../../components/Layout'
import SessionBlock from '../../components/sessions/SessionBlock'

function RunningSession() {
  const t = useTranslations()
  const router = useRouter()
  const [nextBlockOrder, setNextBlockOrder] = useState(-1)
  const [currentBlockOrder, setCurrentBlockOrder] = useState<
    number | undefined
  >(undefined)
  const [activateSessionBlock, { loading: activatingBlock }] = useMutation(
    ActivateSessionBlockDocument
  )
  const [deactivateSessionBlock, { loading: deactivatingBlock }] = useMutation(
    DeactivateSessionBlockDocument
  )
  const [endSession, { loading: endingLiveQuiz }] = useMutation(
    EndSessionDocument,
    {
      refetchQueries: [{ query: GetUserRunningSessionsDocument }],
    }
  )

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

    const sortedBlocks = sort(
      sessionData?.controlSession?.blocks,
      (a, b) => a.order - b.order
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
        <Loader />
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
                <div className="mt-2 flex flex-col gap-2">
                  <FontAwesomeIcon
                    icon={faArrowDown}
                    className="mx-auto w-full"
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
              loading={deactivatingBlock}
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
                className="mx-auto w-full"
              />
            )}
            <SessionBlock
              block={blocks.find((block) => block.order === nextBlockOrder)}
            />
            {nextBlockOrder < blocks.length - 1 && (
              <FontAwesomeIcon
                icon={faEllipsis}
                size="2xl"
                className="mx-auto w-full"
              />
            )}
            <Button
              loading={activatingBlock}
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
                root: 'bg-primary-80 float-right text-white',
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
              loading={endingLiveQuiz}
              onClick={async () => {
                await endSession({ variables: { id: id } })
                router.push(
                  course ? `/course/${course?.id}` : '/course/unassigned'
                )
              }}
              className={{
                root: 'bg-uzh-red-100 float-right text-white',
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

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
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
