import { useQuery } from '@apollo/client'
import {
  GetMicroLearningDocument,
  PublicationStatus,
  SelfDocument,
  StackFeedbackStatus,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Progress, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../../../../../components/common/PreviewMessage'
import { useEscapeRoom } from '../../../../../components/hooks/useEscapeRoom'
import Layout from '../../../../../components/Layout'
import MicroLearningSubscriber from '../../../../../components/microLearning/MicroLearningSubscriber'
import ElementStack from '../../../../../components/practiceQuiz/ElementStack'
import EscapeRoomOverlay from '../../../../../components/practiceQuiz/EscapeRoomOverlay'

function MicrolearningInstance() {
  const t = useTranslations()
  const router = useRouter()
  const ix = parseInt(router.query.ix as string)
  const id = router.query.id as string

  const { loading, data, error, subscribeToMore, refetch } = useQuery(
    GetMicroLearningDocument,
    {
      variables: { id },
      skip: !id,
    }
  )
  const { data: selfData } = useQuery(SelfDocument, {
    skip: data?.microLearning?.isOwner ?? false,
  })

  const hookActivity = data?.microLearning
  const previewMode = hookActivity?.isOwner ?? undefined
  const courseId = hookActivity?.course?.id

  const isEscapeRoom = !!hookActivity?.escapeRoomConfig
  const [escapeRetryNonce, setEscapeRetryNonce] = useState(0)
  const {
    attempt,
    isStarted,
    isCompleted,
    isExpired,
    remainingSeconds,
    startAttempt,
    loading: attemptLoading,
  } = useEscapeRoom({
    activity: hookActivity,
    activityType: 'microLearning',
    refetch,
  })

  // Escape rooms always resume at the first uncleared stack. This prevents
  // skipping ahead and also advances a stale/reloaded URL that still points to
  // an already-cleared stack.
  useEffect(() => {
    if (isEscapeRoom && !previewMode && hookActivity?.stacks) {
      const activeFirstUncleared = hookActivity.stacks.findIndex(
        (stack) => !stack.isCorrect
      )
      if (activeFirstUncleared !== -1 && ix !== activeFirstUncleared) {
        router.replace(
          `/course/${courseId}/microLearnings/${id}/${activeFirstUncleared}`
        )
      }
    }
  }, [
    isEscapeRoom,
    previewMode,
    hookActivity?.stacks,
    ix,
    courseId,
    id,
    router,
  ])

  if (loading) {
    return <Loader />
  }

  if (!data?.microLearning) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }

  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const microLearning = data.microLearning
  const escapeRoomHintPenalty =
    microLearning.escapeRoomConfig?.hintPenalty ?? 120

  const escapeRoomOverlay = isEscapeRoom && !previewMode && (
    <EscapeRoomOverlay
      isStarted={isStarted}
      isCompleted={isCompleted}
      isExpired={isExpired}
      remainingSeconds={remainingSeconds}
      timeLimit={microLearning.escapeRoomConfig?.timeLimit ?? 3600}
      hintPenalty={escapeRoomHintPenalty}
      onStart={async () => {
        await startAttempt()
        await refetch()
      }}
      loading={attemptLoading}
      attempt={attempt}
      clearedStacks={
        microLearning.stacks?.filter((stack) => stack.isCorrect).length ?? 0
      }
      totalStacks={
        microLearning.numOfStacks ?? microLearning.stacks?.length ?? 0
      }
      introText={microLearning.escapeRoomConfig?.introText}
    />
  )

  const currentStack = microLearning.stacks?.[ix]

  if (!currentStack) {
    // Escape rooms withhold their stacks until an attempt is started (or
    // after it expired) — show the intro/lockout overlay instead of failing.
    if (isEscapeRoom && !previewMode) {
      return (
        <Layout
          displayName={microLearning.displayName}
          course={microLearning.course ?? undefined}
        >
          <MicroLearningSubscriber
            activityId={microLearning.id}
            microLearningName={microLearning.displayName}
            subscribeToMore={subscribeToMore}
          />
          {escapeRoomOverlay}
        </Layout>
      )
    }

    throw new Error('Stack not found')
  }

  const handleEscapeAdvance = async (gradedStatus?: StackFeedbackStatus) => {
    if (gradedStatus === StackFeedbackStatus.Correct) {
      await refetch()
      if (
        ix + 1 <
        (microLearning.numOfStacks ?? microLearning.stacks?.length ?? 0)
      ) {
        await router.push(`/course/${courseId}/microLearnings/${id}/${ix + 1}`)
      }
      return
    }

    localStorage.removeItem(`qi-${microLearning.id}-${currentStack.id}`)
    setEscapeRetryNonce((nonce) => nonce + 1)
    await refetch()
  }

  return (
    <Layout
      displayName={microLearning.displayName}
      course={microLearning.course ?? undefined}
    >
      <MicroLearningSubscriber
        activityId={microLearning.id}
        microLearningName={microLearning.displayName}
        subscribeToMore={subscribeToMore}
      />
      {escapeRoomOverlay}
      <div className="flex-1">
        <div
          className={twMerge(
            'w-full space-y-4 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:border md:p-8 md:pt-6'
          )}
        >
          <Progress
            isMaxVisible
            formatter={(v) => v}
            value={ix + 1}
            max={(microLearning?.stacks?.length ?? -1) + 1}
          />
          {previewMode ? (
            <PreviewMessage
              activityType={t('shared.generic.microlearning')}
              name={microLearning.name}
              displayName={microLearning.displayName}
            />
          ) : null}
          <ElementStack
            hideBookmark
            singleSubmission={!isEscapeRoom}
            key={`${currentStack.id}-${isEscapeRoom ? escapeRetryNonce : 0}`}
            parentId={microLearning.id}
            courseId={microLearning.course!.id}
            stack={currentStack}
            currentStep={ix + 1}
            totalSteps={microLearning.stacks?.length ?? 0}
            handleNextElement={
              isEscapeRoom
                ? handleEscapeAdvance
                : () =>
                    router.push(
                      `/course/${courseId}/microLearnings/${id}/${ix + 1}`
                    )
            }
            onAllStacksCompletion={
              isEscapeRoom
                ? handleEscapeAdvance
                : () =>
                    router.push(
                      `/course/${courseId}/microLearnings/${id}/evaluation`
                    )
            }
            withParticipant={
              !!selfData?.self &&
              selfData.self.role !== UserRole.TemporaryParticipant
            }
            activityExpired={microLearning.status === PublicationStatus.Ended}
            activityExpiredMessage={t('pwa.microLearning.activityExpired')}
            previewOnly={previewMode}
            escapeRoom={
              isEscapeRoom
                ? {
                    activityType: 'microLearning',
                    hintPenalty: escapeRoomHintPenalty,
                    onStateChanged: refetch,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default MicrolearningInstance
