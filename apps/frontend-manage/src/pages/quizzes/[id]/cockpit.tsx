import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import AudienceInteraction from '../../../components/interaction/AudienceInteraction'
import Layout from '../../../components/Layout'
import LiveQuizTimeline from '../../../components/liveQuiz/cockpit/LiveQuizTimeline'
import { api } from '../../../lib/trpc'

function Cockpit() {
  const t = useTranslations()
  const router = useRouter()
  const quizId = typeof router.query.id === 'string' ? router.query.id : ''
  const utils = api.useUtils()
  const showCockpitActionError = () => {
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })
  }

  const activateLiveQuizBlock = api.liveQuiz.activateBlock.useMutation()
  const deactivateLiveQuizBlock = api.liveQuiz.deactivateBlock.useMutation()
  const endLiveQuiz = api.liveQuiz.end.useMutation()

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

  if (cockpitError) {
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
  if (cockpitLoading || !cockpitData?.cockpitQuiz)
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
  } = cockpitData.cockpitQuiz

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
            try {
              const result = await endLiveQuiz.mutateAsync({ id })
              if (!result.liveQuiz?.id) {
                showCockpitActionError()
                return
              }

              await utils.liveQuiz.running.invalidate()
              await router.push('/activities')
            } catch {
              showCockpitActionError()
            }
          }}
          handleOpenBlock={async (blockId: number) => {
            try {
              await activateLiveQuizBlock.mutateAsync({
                quizId: id,
                blockId,
              })
              await utils.liveQuiz.cockpit.invalidate({ id })
            } catch {
              showCockpitActionError()
            }
          }}
          handleCloseBlock={async (blockId: number) => {
            try {
              await deactivateLiveQuizBlock.mutateAsync({
                quizId: id,
                blockId,
              })
              await utils.liveQuiz.cockpit.invalidate({ id })
            } catch {
              showCockpitActionError()
            }
          }}
          startedAt={startedAt}
          loading={
            activateLiveQuizBlock.isLoading ||
            deactivateLiveQuizBlock.isLoading ||
            endLiveQuiz.isLoading
          }
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
