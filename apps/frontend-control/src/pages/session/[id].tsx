import { faArrowDown, faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { Button, H3, UserNotification, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { sort } from 'remeda'
import Layout from '../../components/Layout'
import LiveQuizBlock from '../../components/liveQuizzes/LiveQuizBlock'

const elementBlockStatus = {
  scheduled: 'SCHEDULED',
} as const

const liveQuizStatus = {
  ended: 'ENDED',
} as const

function RunningLiveQuiz() {
  const t = useTranslations()
  const router = useRouter()
  const [nextBlockOrder, setNextBlockOrder] = useState(-1)
  const [currentBlockOrder, setCurrentBlockOrder] = useState<
    number | undefined
  >(undefined)
  const quizId = router.query.id
  const validQuizId = typeof quizId === 'string' ? quizId : undefined
  const utils = trpc.useUtils()
  const showControlActionError = () => {
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })
  }
  const refreshCurrentLiveQuiz = () => {
    if (validQuizId) {
      void utils.liveQuiz.control
        .invalidate({ id: validQuizId })
        .catch(console.error)
    }
  }
  const activateLiveQuizBlock = trpc.liveQuiz.activateBlock.useMutation()
  const deactivateLiveQuizBlock = trpc.liveQuiz.deactivateBlock.useMutation()
  const endLiveQuiz = trpc.liveQuiz.end.useMutation()

  const {
    isLoading: quizLoading,
    error: quizError,
    data: quizData,
  } = trpc.liveQuiz.control.useQuery(
    { id: validQuizId ?? '' },
    { enabled: typeof validQuizId !== 'undefined', refetchInterval: 1000 }
  )

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
      (block) => block.status === elementBlockStatus.scheduled
    )
    setNextBlockOrder(
      typeof scheduledNext === 'undefined' ? -1 : scheduledNext.order
    )
  }, [quizData?.controlLiveQuiz?.blocks])

  const controlLiveQuiz = quizData?.controlLiveQuiz

  if (quizLoading && !controlLiveQuiz) {
    return (
      <Layout title={t('control.liveQuiz.liveQuizControl')}>
        <Loader />
      </Layout>
    )
  }

  if (quizError && !controlLiveQuiz) {
    return (
      <Layout title={t('control.liveQuiz.liveQuizControl')}>
        <UserNotification
          message={t('control.liveQuiz.errorLoadingLiveQuiz')}
          type="error"
        />
      </Layout>
    )
  }

  if (!controlLiveQuiz) {
    return (
      <Layout title={t('control.liveQuiz.liveQuizControl')}>
        <UserNotification
          message={t('control.liveQuiz.errorLoadingLiveQuiz')}
          type="error"
        />
      </Layout>
    )
  }

  const { id, name, course, blocks } = controlLiveQuiz

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
              loading={deactivateLiveQuizBlock.isLoading}
              onClick={async () => {
                const blockId = blocks.find(
                  (block) => block.order === currentBlockOrder
                )?.id
                if (typeof blockId === 'undefined') return

                try {
                  const result = await deactivateLiveQuizBlock.mutateAsync({
                    quizId: id,
                    blockId,
                  })
                  if (!result.deactivated) {
                    showControlActionError()
                    return
                  }

                  refreshCurrentLiveQuiz()
                  setCurrentBlockOrder(undefined)
                } catch {
                  showControlActionError()
                }
              }}
              disabled={deactivateLiveQuizBlock.isLoading}
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
              loading={activateLiveQuizBlock.isLoading}
              onClick={async () => {
                const blockId = blocks.find(
                  (block) => block.order === nextBlockOrder
                )?.id
                if (typeof blockId === 'undefined') return

                try {
                  const result = await activateLiveQuizBlock.mutateAsync({
                    quizId: id,
                    blockId,
                  })
                  if (!result.liveQuiz) {
                    showControlActionError()
                    return
                  }

                  refreshCurrentLiveQuiz()
                  setCurrentBlockOrder(nextBlockOrder)
                  setNextBlockOrder(nextBlockOrder + 1)
                } catch {
                  showControlActionError()
                }
              }}
              disabled={activateLiveQuizBlock.isLoading}
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
              loading={endLiveQuiz.isLoading}
              onClick={async () => {
                try {
                  const result = await endLiveQuiz.mutateAsync({ id })
                  if (result.liveQuiz?.status !== liveQuizStatus.ended) {
                    showControlActionError()
                    return
                  }

                  refreshCurrentLiveQuiz()
                  if (course) {
                    void utils.course.controlCourse
                      .invalidate({
                        courseId: course.id,
                      })
                      .catch(console.error)
                  } else {
                    void utils.liveQuiz.unassigned
                      .invalidate()
                      .catch(console.error)
                  }
                  void router
                    .push(
                      course ? `/course/${course.id}` : '/course/unassigned'
                    )
                    .catch((error) => {
                      console.error(error)
                      showControlActionError()
                    })
                } catch {
                  showControlActionError()
                }
              }}
              disabled={endLiveQuiz.isLoading}
              className={{
                root: 'bg-uzh-red-100 hover:bg-uzh-red-100 float-right text-white',
              }}
              data={{ cy: 'end-live-quiz' }}
            >
              <Button.Label>{t('control.liveQuiz.endQuiz')}</Button.Label>
            </Button>
          </div>
        )}

        {typeof currentBlockOrder !== 'undefined' && nextBlockOrder == -1 && (
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
