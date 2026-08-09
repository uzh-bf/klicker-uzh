import { useMutation, useQuery } from '@apollo/client'
import { faArrowDown, faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivateLiveQuizBlockDocument,
  DeactivateLiveQuizBlockDocument,
  ElementBlockStatus,
  EndLiveQuizDocument,
  GetControlLiveQuizDocument,
  GetUnassignedLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { sort } from 'remeda'
import Layout from '../../components/Layout'
import LiveQuizBlock from '../../components/liveQuizzes/LiveQuizBlock'

function RunningLiveQuiz() {
  const t = useTranslations()
  const router = useRouter()
  const [nextBlockOrder, setNextBlockOrder] = useState(-1)
  const [currentBlockOrder, setCurrentBlockOrder] = useState<
    number | undefined
  >(undefined)

  const [activateLiveQuizBlock, { loading: activatingBlock }] = useMutation(
    ActivateLiveQuizBlockDocument
  )
  const [deactivateLiveQuizBlock, { loading: deactivatingBlock }] = useMutation(
    DeactivateLiveQuizBlockDocument
  )
  const [endLiveQuiz, { loading: endingLiveQuiz }] = useMutation(
    EndLiveQuizDocument,
    {
      update(cache, { data }) {
        // verify that the quiz has been ended successfully
        if (!data?.endLiveQuiz) return

        // remove the ended live quiz from the unassigned list in control application (not shown here)
        cache.updateQuery(
          { query: GetUnassignedLiveQuizzesDocument },
          (qData) => {
            if (!qData?.unassignedLiveQuizzes) return qData

            return {
              unassignedLiveQuizzes: qData.unassignedLiveQuizzes.filter(
                (q) => q.id !== data.endLiveQuiz!.id
              ),
            }
          }
        )
      },
    }
  )

  const {
    loading: quizLoading,
    error: quizError,
    data: quizData,
  } = useQuery(GetControlLiveQuizDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 1000,
    skip: !router.query.id,
  })

  useEffect(() => {
    setCurrentBlockOrder(quizData?.controlLiveQuiz?.activeBlock?.order)
  }, [quizData?.controlLiveQuiz?.id, quizData?.controlLiveQuiz?.activeBlock])

  useEffect(() => {
    if (!quizData?.controlLiveQuiz?.blocks) return

    const sortedBlocks = sort(
      quizData?.controlLiveQuiz?.blocks,
      (a, b) => a.order - b.order
    )

    if (!sortedBlocks) return
    const scheduledNext = sortedBlocks.find(
      (block) => block.status === ElementBlockStatus.Scheduled
    )
    setNextBlockOrder(
      typeof scheduledNext === 'undefined' ? -1 : scheduledNext.order
    )
  }, [quizData?.controlLiveQuiz?.blocks])

  if (quizLoading) {
    return (
      <Layout title={t('control.liveQuiz.liveQuizControl')}>
        <Loader />
      </Layout>
    )
  }

  if (!quizData?.controlLiveQuiz || quizError) {
    return (
      <Layout title={t('control.liveQuiz.liveQuizControl')}>
        <UserNotification
          message={t('control.liveQuiz.errorLoadingLiveQuiz')}
          type="error"
        />
      </Layout>
    )
  }

  const { id, name, course, blocks } = quizData.controlLiveQuiz

  if (!blocks) {
    return (
      <Layout title={name}>
        <UserNotification
          type="warning"
          message={t('control.liveQuiz.containsNoQuestions')}
        />
      </Layout>
    )
  }

  return (
    <Layout
      title={t('control.liveQuiz.liveQuizWithName', { name: name })}
      quizId={id}
    >
      <div key={`${currentBlockOrder}-${nextBlockOrder}`}>
        {typeof currentBlockOrder !== 'undefined' ? (
          <div key={`${currentBlockOrder}-${nextBlockOrder}-child`}>
            <H3>{t('control.liveQuiz.activeBlock')}</H3>

            <LiveQuizBlock
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

                  <LiveQuizBlock
                    block={blocks.find(
                      (block) => block.order === nextBlockOrder
                    )}
                  />
                </div>
              )}
            <Button
              loading={deactivatingBlock}
              onClick={async () => {
                await deactivateLiveQuizBlock({
                  variables: {
                    quizId: id,
                    blockId:
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
              <Button.Label>{t('control.liveQuiz.closeBlock')}</Button.Label>
            </Button>
          </div>
        ) : nextBlockOrder !== -1 ? (
          <div>
            <H3>{t('control.liveQuiz.nextBlock')}</H3>
            {nextBlockOrder > 0 && (
              <FontAwesomeIcon
                icon={faEllipsis}
                size="2xl"
                className="mx-auto w-full"
              />
            )}
            <LiveQuizBlock
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
                  await activateLiveQuizBlock({
                    variables: {
                      quizId: id,
                      blockId:
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
              <Button.Label>
                {t('control.liveQuiz.activateBlockN', {
                  number: nextBlockOrder + 1,
                })}
              </Button.Label>
            </Button>
          </div>
        ) : (
          <div>
            <UserNotification
              type="info"
              message={t('control.liveQuiz.hintAllBlocksClosed')}
              className={{ root: 'mb-2' }}
            />
            <Button
              loading={endingLiveQuiz}
              onClick={async () => {
                await endLiveQuiz({ variables: { id: id } })
                router.push(
                  course ? `/course/${course?.id}` : '/course/unassigned'
                )
              }}
              className={{
                root: 'bg-uzh-red-100 hover:bg-uzh-red-100 float-right text-white',
              }}
              data={{ cy: 'end-live-quiz' }}
            >
              <Button.Label>{t('control.liveQuiz.endQuiz')}</Button.Label>
            </Button>
          </div>
        )}

        {typeof currentBlockOrder !== 'undefined' && nextBlockOrder === -1 && (
          <UserNotification
            message={t('control.liveQuiz.hintLastBlock')}
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

export default RunningLiveQuiz
