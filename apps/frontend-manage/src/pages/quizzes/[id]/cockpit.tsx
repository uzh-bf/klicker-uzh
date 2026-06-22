import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import AudienceInteraction from '../../../components/interaction/AudienceInteraction'
import Layout from '../../../components/Layout'
import LiveQuizTimeline from '../../../components/liveQuiz/cockpit/LiveQuizTimeline'
import { api } from '../../../lib/trpc'

function Cockpit() {
  const t = useTranslations()
  const router = useRouter()
  const quizId = typeof router.query.id === 'string' ? router.query.id : ''
  const utils = api.useUtils()
  const [cockpitActionPending, setCockpitActionPending] = useState(false)
  const showCockpitActionError = () => {
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })
  }

  const activateLiveQuizBlock = api.liveQuiz.activateBlock.useMutation({
    onSuccess: async () => {
      await utils.liveQuiz.cockpit
        .invalidate({ id: quizId })
        .catch(console.error)
    },
  })
  const deactivateLiveQuizBlock = api.liveQuiz.deactivateBlock.useMutation({
    onSuccess: async () => {
      await utils.liveQuiz.cockpit
        .invalidate({ id: quizId })
        .catch(console.error)
    },
  })
  const endLiveQuiz = api.liveQuiz.end.useMutation({
    onSuccess: async (result) => {
      if (!result.liveQuiz?.id) return
      await utils.liveQuiz.running.invalidate().catch(console.error)
    },
  })
  const cockpitActionLoading =
    activateLiveQuizBlock.isLoading ||
    deactivateLiveQuizBlock.isLoading ||
    endLiveQuiz.isLoading ||
    cockpitActionPending

  const {
    data: cockpitData,
    refetch: refetchCockpitQuiz,
    isLoading: cockpitLoading,
    error: cockpitError,
  } = api.liveQuiz.cockpit.useQuery(
    { id: quizId },
    {
      enabled: Boolean(quizId),
      refetchInterval: 2000,
    }
  )
  const cockpitQuiz = cockpitData?.cockpitQuiz

  if (cockpitError && !cockpitQuiz) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  // data has not been received yet
  if (cockpitLoading || !cockpitQuiz)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  const {
    id,
    name,
    displayName,
    pinCode,
    isLiveQAEnabled,
    isGamificationEnabled,
    isAssessmentEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
    startedAt,
    course,
    blocks,
    confusionSummary,
    feedbacks,
  } = cockpitQuiz

  return (
    <Layout>
      <div className="mb-8 print:hidden">
        <LiveQuizTimeline
          assessmentMode={isAssessmentEnabled}
          quizId={id}
          quizName={name}
          quizDisplayName={displayName}
          quizPin={pinCode}
          blocks={blocks ?? []}
          language={course?.language ?? null}
          isGamificationEnabled={isGamificationEnabled}
          handleEndLiveQuiz={async () => {
            if (cockpitActionLoading) return

            let releasePending = true
            setCockpitActionPending(true)

            try {
              const result = await endLiveQuiz.mutateAsync({ id })
              if (!result.liveQuiz?.id) {
                showCockpitActionError()
                return
              }

              const routed = await router.push('/activities')
              if (!routed) throw new Error('Live quiz end navigation failed')
              releasePending = false
            } catch (error) {
              console.error(error)
              showCockpitActionError()
            } finally {
              if (releasePending) {
                setCockpitActionPending(false)
              }
            }
          }}
          handleOpenBlock={async (blockId: number) => {
            if (cockpitActionLoading) return

            setCockpitActionPending(true)

            try {
              await activateLiveQuizBlock.mutateAsync({
                quizId: id,
                blockId,
              })
            } catch (error) {
              console.error(error)
              showCockpitActionError()
            } finally {
              setCockpitActionPending(false)
            }
          }}
          handleCloseBlock={async (blockId: number) => {
            if (cockpitActionLoading) return

            setCockpitActionPending(true)

            try {
              await deactivateLiveQuizBlock.mutateAsync({
                quizId: id,
                blockId,
              })
            } catch (error) {
              console.error(error)
              showCockpitActionError()
            } finally {
              setCockpitActionPending(false)
            }
          }}
          startedAt={startedAt}
          loading={cockpitActionLoading}
        />
      </div>

      <AudienceInteraction
        onFeedbackCreated={refetchCockpitQuiz}
        confusionValues={confusionSummary ?? undefined}
        feedbacks={feedbacks ?? []}
        isLiveQAEnabled={isLiveQAEnabled}
        isConfusionFeedbackEnabled={isConfusionFeedbackEnabled}
        isModerationEnabled={isModerationEnabled}
        quizId={id}
        liveQuizName={name}
      />
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

export default Cockpit
