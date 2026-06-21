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
  const invalidateCurrentLiveQuiz = async () => {
    if (validQuizId) {
      await utils.liveQuiz.control.invalidate({ id: validQuizId })
    }
  }
  const activateLiveQuizBlock = trpc.liveQuiz.activateBlock.useMutation({
    onSuccess: invalidateCurrentLiveQuiz,
  })
  const deactivateLiveQuizBlock = trpc.liveQuiz.deactivateBlock.useMutation({
    onSuccess: invalidateCurrentLiveQuiz,
  })
  const endLiveQuiz = trpc.liveQuiz.end.useMutation({
    onSuccess: invalidateCurrentLiveQuiz,
  })

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

  const { id, name, course, blocks } = quizData?.controlLiveQuiz

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
                  await deactivateLiveQuizBlock.mutateAsync({
                    quizId: id,
                    blockId,
                  })
                  setCurrentBlockOrder(undefined)
                } catch {
                  showControlActionError()
                }
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
              loading={activateLiveQuizBlock.isLoading}
              onClick={async () => {
                const blockId = blocks.find(
                  (block) => block.order === nextBlockOrder
                )?.id
                if (typeof blockId === 'undefined') return

                try {
                  await activateLiveQuizBlock.mutateAsync({
                    quizId: id,
                    blockId,
                  })
                  setCurrentBlockOrder(nextBlockOrder)
                  setNextBlockOrder(nextBlockOrder + 1)
                } catch {
                  showControlActionError()
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
              loading={endLiveQuiz.isLoading}
              onClick={async () => {
                try {
                  await endLiveQuiz.mutateAsync({ id })
                  if (course) {
                    await utils.course.controlCourse.invalidate({
                      courseId: course.id,
                    })
                  } else {
                    await utils.liveQuiz.unassigned.invalidate()
                  }
                  await router.push(
                    course ? `/course/${course?.id}` : '/course/unassigned'
                  )
                } catch {
                  showControlActionError()
                }
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
