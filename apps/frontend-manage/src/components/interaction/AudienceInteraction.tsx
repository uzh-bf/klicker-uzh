import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { push } from '@socialgouv/matomo-next'
import { H2, Switch, toast } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useTranslations } from 'next-intl'
import { api } from '../../lib/trpc'
import ConfusionCharts from './confusion/ConfusionCharts'
import FeedbackChannel from './feedbacks/FeedbackChannel'
import ModerationChangeModal from './feedbacks/ModerationChangeModal'
import type { AudienceFeedback, ConfusionSummary } from './types'

interface Props {
  quizId: string
  liveQuizName: string
  confusionValues?: ConfusionSummary
  feedbacks?: AudienceFeedback[]
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isModerationEnabled: boolean
  onFeedbackCreated: () => unknown | Promise<unknown>
}

function AudienceInteraction({
  quizId,
  liveQuizName,
  confusionValues,
  feedbacks,
  isLiveQAEnabled,
  isConfusionFeedbackEnabled,
  isModerationEnabled,
  onFeedbackCreated,
}: Props) {
  const t = useTranslations()
  const [showModerationModal, setShowModerationModal] = useState(false)
  const [moderationChangeLoading, setModerationChangeLoading] = useState(false)
  const [settingsActionPending, setSettingsActionPending] = useState(false)
  const onFeedbackCreatedRef = useRef(onFeedbackCreated)
  const utils = api.useUtils()

  useEffect(() => {
    onFeedbackCreatedRef.current = onFeedbackCreated
  }, [onFeedbackCreated])

  api.realtime.feedbackCreated.useSubscription(
    { quizId },
    {
      enabled: Boolean(quizId),
      onData() {
        void Promise.resolve(onFeedbackCreatedRef.current()).catch(
          console.error
        )
      },
    }
  )

  const changeQuizSettings = api.liveQuiz.changeSettings.useMutation()
  const publishFeedback = api.liveQuiz.publishFeedback.useMutation()
  const pinFeedback = api.liveQuiz.pinFeedback.useMutation()
  const resolveFeedback = api.liveQuiz.resolveFeedback.useMutation()
  const deleteFeedback = api.liveQuiz.deleteFeedback.useMutation()
  const deleteFeedbackResponse =
    api.liveQuiz.deleteFeedbackResponse.useMutation()
  const respondToFeedback = api.liveQuiz.respondToFeedback.useMutation()

  async function refetchAudienceInteraction() {
    await Promise.all([
      onFeedbackCreatedRef.current(),
      utils.liveQuiz.cockpit.invalidate({ id: quizId }),
      utils.liveQuiz.lecturerView.invalidate({ id: quizId }),
    ])
  }

  function showAudienceInteractionError() {
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })
  }

  async function runAudienceInteractionMutation(
    action: () => Promise<unknown>
  ) {
    try {
      await action()
      await refetchAudienceInteraction().catch(console.error)
      return true
    } catch (error) {
      console.error(error)
      showAudienceInteractionError()
      return false
    }
  }

  async function runAudienceSettingsMutation(action: () => Promise<unknown>) {
    if (settingsActionPending) return false

    setSettingsActionPending(true)
    try {
      return await runAudienceInteractionMutation(action)
    } finally {
      setSettingsActionPending(false)
    }
  }

  const settingsLoading =
    changeQuizSettings.isLoading ||
    settingsActionPending ||
    moderationChangeLoading

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center print:hidden">
          <H2 className={{ root: 'mb-0' }}>{t('manage.cockpit.liveQA')}</H2>
          <div className="flex flex-row flex-wrap items-center gap-3">
            <Link
              href={`/quizzes/${quizId}/lecturer`}
              target="_blank"
              passHref
              legacyBehavior
            >
              <a
                className="mr-3 inline-flex items-center gap-1.5 text-base hover:underline"
                data-cy={`open-lecturer-overview-live-quiz-${liveQuizName}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FontAwesomeIcon icon={faUpRightFromSquare} />
                {t('manage.cockpit.lecturerView')}
              </a>
            </Link>
            <Switch
              data={{ cy: 'toggle-qa' }}
              checked={isLiveQAEnabled}
              onCheckedChange={async () => {
                const success = await runAudienceSettingsMutation(() =>
                  changeQuizSettings.mutateAsync({
                    id: quizId,
                    isLiveQAEnabled: !isLiveQAEnabled,
                  })
                )
                if (success) {
                  push([
                    'trackEvent',
                    'Running Live Quiz',
                    !isLiveQAEnabled
                      ? 'Feedback Channel Activated'
                      : 'Feedback Channel Deactivated',
                  ])
                }
              }}
              label={t('manage.cockpit.activateQA')}
              disabled={settingsLoading}
            />
            <Switch
              data={{ cy: 'toggle-moderation' }}
              checked={isModerationEnabled}
              disabled={!isLiveQAEnabled || settingsLoading}
              onCheckedChange={async () => {
                if (isModerationEnabled === true) {
                  // count unpublished feedbacks when disabling moderation and show confirmation modal if necessary
                  const unpublishedCount =
                    feedbacks?.filter((f) => !f.isPublished).length || 0
                  if (unpublishedCount > 0) {
                    setShowModerationModal(true)
                    return
                  }
                }

                // if no unpublished feedbacks, directly toggle moderation
                const success = await runAudienceSettingsMutation(() =>
                  changeQuizSettings.mutateAsync({
                    id: quizId,
                    isModerationEnabled: !isModerationEnabled,
                  })
                )

                if (success) {
                  push([
                    'trackEvent',
                    'Running Live Quiz',
                    'Feedback Moderation Toggled',
                    String(!isModerationEnabled),
                  ])
                }
              }}
              label={t('manage.cockpit.activateModeration')}
              className={{
                element: twMerge(!isLiveQAEnabled && 'bg-uzh-grey-40'),
                label: twMerge(!isLiveQAEnabled && 'text-gray-40'),
              }}
            />
          </div>
        </div>

        {!isLiveQAEnabled && (
          <div className="flex flex-1 items-center justify-center rounded border font-bold print:hidden">
            {t('manage.cockpit.QaNotActive')}
          </div>
        )}

        {isLiveQAEnabled && (
          <div className="flex flex-1 flex-col rounded print:border-0">
            <FeedbackChannel
              liveQuizName={liveQuizName}
              feedbacks={feedbacks}
              handleDeleteFeedback={async (feedbackId: number) => {
                const success = await runAudienceInteractionMutation(() =>
                  deleteFeedback.mutateAsync({
                    id: feedbackId,
                    liveQuizId: quizId,
                  })
                )
                if (success) {
                  push(['trackEvent', 'Running Live Quiz', 'Feedback Deleted'])
                }
                return success
              }}
              handleDeleteFeedbackResponse={async (responseId: number) => {
                const success = await runAudienceInteractionMutation(() =>
                  deleteFeedbackResponse.mutateAsync({
                    id: responseId,
                    liveQuizId: quizId,
                  })
                )

                if (success) {
                  push([
                    'trackEvent',
                    'Running Live Quiz',
                    'Feedback Response Deleted',
                  ])
                }
                return success
              }}
              handlePinFeedback={async (
                feedbackId: number,
                isPinned: boolean
              ) => {
                const success = await runAudienceInteractionMutation(() =>
                  pinFeedback.mutateAsync({
                    id: feedbackId,
                    isPinned,
                    liveQuizId: quizId,
                  })
                )
                if (success) {
                  push([
                    'trackEvent',
                    'Running Live Quiz',
                    'Feedback Pinned',
                    String(isPinned),
                  ])
                }
                return success
              }}
              handlePublishFeedback={async (
                feedbackId: number,
                isPublished: boolean
              ) => {
                const success = await runAudienceInteractionMutation(() =>
                  publishFeedback.mutateAsync({
                    id: feedbackId,
                    isPublished,
                    liveQuizId: quizId,
                  })
                )
                if (success) {
                  push([
                    'trackEvent',
                    'Running Live Quiz',
                    'Feedback Published',
                    String(isPublished),
                  ])
                }
                return success
              }}
              handleResolveFeedback={async (
                feedbackId: number,
                isResolved: boolean
              ) => {
                const success = await runAudienceInteractionMutation(() =>
                  resolveFeedback.mutateAsync({
                    id: feedbackId,
                    isResolved,
                    liveQuizId: quizId,
                  })
                )
                if (success) {
                  push([
                    'trackEvent',
                    'Running Live Quiz',
                    'Feedback Resolved',
                    String(isResolved),
                  ])
                }
                return success
              }}
              handleRespondToFeedback={async (
                feedbackId: number,
                response: string
              ) => {
                const success = await runAudienceInteractionMutation(() =>
                  respondToFeedback.mutateAsync({
                    id: feedbackId,
                    responseContent: response,
                    liveQuizId: quizId,
                  })
                )
                if (success) {
                  push([
                    'trackEvent',
                    'Running Live Quiz',
                    'Feedback Response Added',
                    response.length,
                  ])
                }
                return success
              }}
              isActive={isLiveQAEnabled}
              isPublic={!isModerationEnabled}
            />
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-3 lg:w-80 print:hidden">
        <div className="flex items-center justify-between">
          <H2 className={{ root: 'mb-0' }}>{t('shared.generic.feedback')}</H2>
          <Switch
            data={{ cy: 'toggle-gamification' }}
            checked={isConfusionFeedbackEnabled}
            onCheckedChange={async () => {
              const success = await runAudienceSettingsMutation(() =>
                changeQuizSettings.mutateAsync({
                  id: quizId,
                  isConfusionFeedbackEnabled: !isConfusionFeedbackEnabled,
                })
              )
              if (success) {
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Confusion Feedback Toggled',
                  String(!isConfusionFeedbackEnabled),
                ])
              }
            }}
            label={t('manage.cockpit.activateFeedback')}
            disabled={settingsLoading}
          />
        </div>
        <div className="h-max rounded border p-4">
          {isConfusionFeedbackEnabled ? (
            <ConfusionCharts confusionValues={confusionValues} />
          ) : (
            <div className="flex min-h-[355px] items-center justify-center font-bold">
              {t('manage.cockpit.feedbackNotActive')}
            </div>
          )}
        </div>
      </div>

      {showModerationModal && (
        <ModerationChangeModal
          open={showModerationModal}
          onClose={() => setShowModerationModal(false)}
          onConfirm={async () => {
            setModerationChangeLoading(true)
            try {
              const success = await runAudienceSettingsMutation(() =>
                changeQuizSettings.mutateAsync({
                  id: quizId,
                  isModerationEnabled: false,
                })
              )
              if (success) {
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Moderation Disabled With Auto-Publish',
                ])
              }
              return success
            } finally {
              setModerationChangeLoading(false)
            }
          }}
          unpublishedCount={
            feedbacks?.filter((f) => !f.isPublished).length || 0
          }
          loading={settingsLoading}
        />
      )}
    </div>
  )
}

export default AudienceInteraction
