import { SubscribeToMoreOptions, useMutation } from '@apollo/client'
import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeLiveQuizSettingsDocument,
  ConfusionSummary,
  DeleteFeedbackDocument,
  DeleteFeedbackResponseDocument,
  Feedback,
  FeedbackCreatedDocument,
  GetCockpitQuizDocument,
  LiveQuiz,
  PinFeedbackDocument,
  PublishFeedbackDocument,
  ResolveFeedbackDocument,
  RespondToFeedbackDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { push } from '@socialgouv/matomo-next'
import { H2, Switch } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useTranslations } from 'next-intl'
import ConfusionCharts from './confusion/ConfusionCharts'
import FeedbackChannel from './feedbacks/FeedbackChannel'
import ModerationChangeModal from './feedbacks/ModerationChangeModal'

interface Props {
  quizId: string
  liveQuizName: string
  confusionValues?: ConfusionSummary
  feedbacks?: Feedback[]
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isModerationEnabled: boolean
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}

function AudienceInteraction({
  quizId,
  liveQuizName,
  confusionValues,
  feedbacks,
  isLiveQAEnabled,
  isConfusionFeedbackEnabled,
  isModerationEnabled,
  subscribeToMore,
}: Props) {
  const t = useTranslations()
  const [showModerationModal, setShowModerationModal] = useState(false)
  const [moderationChangeLoading, setModerationChangeLoading] = useState(false)

  useEffect(() => {
    if (!quizId) return

    const feedbackAdded = subscribeToMore({
      document: FeedbackCreatedDocument,
      variables: { quizId },
      updateQuery: (
        prev: { cockpitQuiz: LiveQuiz },
        {
          subscriptionData,
        }: { subscriptionData: { data: { feedbackCreated: Feedback } } }
      ) => {
        if (!subscriptionData.data) return prev
        const newItem = subscriptionData.data.feedbackCreated
        const updatedQuiz = {
          ...prev.cockpitQuiz,
          feedbacks: [newItem, ...(prev.cockpitQuiz.feedbacks ?? [])],
        }

        return {
          cockpitQuiz: updatedQuiz,
        }
      },
    })

    return () => {
      feedbackAdded && feedbackAdded()
    }
  }, [subscribeToMore, quizId])

  const [changeQuizSettings] = useMutation(ChangeLiveQuizSettingsDocument, {
    update: (cache, { data }) => {
      // verify that the mutation was successful
      if (!data?.changeLiveQuizSettings) return

      cache.updateQuery(
        { query: GetCockpitQuizDocument, variables: { id: quizId } },
        (qData) => {
          if (!qData?.cockpitQuiz) return qData
          return {
            cockpitQuiz: {
              ...qData.cockpitQuiz,
              isLiveQAEnabled: data.changeLiveQuizSettings!.isLiveQAEnabled,
              isConfusionFeedbackEnabled:
                data.changeLiveQuizSettings!.isConfusionFeedbackEnabled,
              isModerationEnabled:
                data.changeLiveQuizSettings!.isModerationEnabled,
            },
          }
        }
      )
    },
  })

  const [publishFeedback] = useMutation(PublishFeedbackDocument, {
    update: (cache, { data }) => {
      // verify that the mutation was successful
      if (!data?.publishFeedback) return

      // update the cached feedback with the correct flag
      cache.updateQuery(
        { query: GetCockpitQuizDocument, variables: { id: quizId } },
        (qData) => {
          if (!qData?.cockpitQuiz) return qData
          return {
            cockpitQuiz: {
              ...qData.cockpitQuiz,
              feedbacks: qData.cockpitQuiz.feedbacks?.map((feedback) =>
                feedback.id === data.publishFeedback!.id
                  ? {
                      ...feedback,
                      isPublished: data.publishFeedback!.isPublished,
                    }
                  : feedback
              ),
            },
          }
        }
      )
    },
  })

  const [pinFeedback] = useMutation(PinFeedbackDocument, {
    update: (cache, { data }) => {
      // verify that the mutation was successful
      if (!data?.pinFeedback) return

      // update the cached feedback with the correct flag
      cache.updateQuery(
        { query: GetCockpitQuizDocument, variables: { id: quizId } },
        (qData) => {
          if (!qData?.cockpitQuiz) return qData
          return {
            cockpitQuiz: {
              ...qData.cockpitQuiz,
              feedbacks: qData.cockpitQuiz.feedbacks?.map((feedback) =>
                feedback.id === data.pinFeedback!.id
                  ? {
                      ...feedback,
                      isPinned: data.pinFeedback!.isPinned,
                    }
                  : feedback
              ),
            },
          }
        }
      )
    },
  })

  const [resolveFeedback] = useMutation(ResolveFeedbackDocument, {
    update: (cache, { data }) => {
      // verify that the mutation was successful
      if (!data?.resolveFeedback) return

      // update the cached feedback with the correct flag
      cache.updateQuery(
        { query: GetCockpitQuizDocument, variables: { id: quizId } },
        (qData) => {
          if (!qData?.cockpitQuiz) return qData
          return {
            cockpitQuiz: {
              ...qData.cockpitQuiz,
              feedbacks: qData.cockpitQuiz.feedbacks?.map((feedback) =>
                feedback.id === data.resolveFeedback!.id
                  ? {
                      ...feedback,
                      isResolved: data.resolveFeedback!.isResolved,
                    }
                  : feedback
              ),
            },
          }
        }
      )
    },
  })

  const [deleteFeedback] = useMutation(DeleteFeedbackDocument, {
    update(cache, { data }) {
      // verify that the deletion of the feedback was successful
      if (!data?.deleteFeedback) return

      // update the cache to remove the deleted feedback
      cache.updateQuery(
        {
          query: GetCockpitQuizDocument,
          variables: { id: quizId },
        },
        (qData) => {
          if (!qData?.cockpitQuiz) return qData
          return {
            cockpitQuiz: {
              ...qData.cockpitQuiz,
              feedbacks: qData.cockpitQuiz.feedbacks?.filter(
                (feedback) => feedback.id !== data.deleteFeedback!.id
              ),
            },
          }
        }
      )
    },
  })

  const [deleteFeedbackResponse] = useMutation(DeleteFeedbackResponseDocument, {
    update(cache, { data }) {
      // verify that the response deletion was successful
      if (!data?.deleteFeedbackResponse) return

      // update the cache with the updated feedback (returned by mutation)
      cache.updateQuery(
        { query: GetCockpitQuizDocument, variables: { id: quizId } },
        (qData) => {
          if (!qData?.cockpitQuiz) return qData

          return {
            cockpitQuiz: {
              ...qData.cockpitQuiz,
              feedbacks: qData.cockpitQuiz.feedbacks?.map((feedback) =>
                feedback.id === data.deleteFeedbackResponse!.id
                  ? {
                      ...feedback,
                      responses: data.deleteFeedbackResponse!.responses,
                    }
                  : feedback
              ),
            },
          }
        }
      )
    },
  })

  const [respondToFeedback] = useMutation(RespondToFeedbackDocument, {
    update(cache, { data }) {
      // verify that the response addition was successful
      if (!data?.respondToFeedback) return

      // update the cache with the updated feedback (returned by mutation)
      cache.updateQuery(
        { query: GetCockpitQuizDocument, variables: { id: quizId } },
        (qData) => {
          if (!qData?.cockpitQuiz) return qData

          return {
            cockpitQuiz: {
              ...qData.cockpitQuiz,
              feedbacks: qData.cockpitQuiz.feedbacks?.map((feedback) =>
                feedback.id === data.respondToFeedback!.id
                  ? {
                      ...feedback,
                      responses: data.respondToFeedback!.responses,
                    }
                  : feedback
              ),
            },
          }
        }
      )
    },
  })

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center print:hidden">
          <H2 className={{ root: 'mb-0' }}>{t('manage.cockpit.liveQA')}</H2>
          <div className="flex flex-row flex-wrap items-center gap-3">
            <Link
              href={`/quizzes/${quizId}/lecturer`}
              target="_blank"
              className="mr-3 inline-flex items-center gap-1.5 text-base hover:underline"
              data-cy={`open-lecturer-overview-live-quiz-${liveQuizName}`}
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={faUpRightFromSquare} />
              {t('manage.cockpit.lecturerView')}
            </Link>
            <Switch
              data={{ cy: 'toggle-qa' }}
              checked={isLiveQAEnabled}
              onCheckedChange={async () => {
                await changeQuizSettings({
                  variables: { id: quizId, isLiveQAEnabled: !isLiveQAEnabled },
                })
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  !isLiveQAEnabled
                    ? 'Feedback Channel Activated'
                    : 'Feedback Channel Deactivated',
                ])
              }}
              label={t('manage.cockpit.activateQA')}
            />
            <Switch
              data={{ cy: 'toggle-moderation' }}
              checked={isModerationEnabled}
              disabled={!isLiveQAEnabled}
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
                await changeQuizSettings({
                  variables: {
                    id: quizId,
                    isModerationEnabled: !isModerationEnabled,
                  },
                })

                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Moderation Toggled',
                  String(!isModerationEnabled),
                ])
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
                await deleteFeedback({
                  variables: { id: feedbackId, liveQuizId: quizId },
                  optimisticResponse: {
                    deleteFeedback: {
                      __typename: 'Feedback',
                      id: feedbackId,
                    },
                  },
                })
                push(['trackEvent', 'Running Live Quiz', 'Feedback Deleted'])
              }}
              handleDeleteFeedbackResponse={async (responseId: number) => {
                await deleteFeedbackResponse({
                  variables: { id: responseId, liveQuizId: quizId },
                })

                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Response Deleted',
                ])
              }}
              handlePinFeedback={async (
                feedbackId: number,
                isPinned: boolean
              ) => {
                await pinFeedback({
                  variables: {
                    id: feedbackId,
                    isPinned,
                    liveQuizId: quizId,
                  },
                  optimisticResponse: {
                    pinFeedback: {
                      __typename: 'Feedback',
                      id: feedbackId,
                      isPinned,
                    },
                  },
                })
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Pinned',
                  String(isPinned),
                ])
              }}
              handlePublishFeedback={async (
                feedbackId: number,
                isPublished: boolean
              ) => {
                await publishFeedback({
                  variables: {
                    id: feedbackId,
                    isPublished,
                    liveQuizId: quizId,
                  },
                  optimisticResponse: {
                    publishFeedback: {
                      __typename: 'Feedback',
                      id: feedbackId,
                      isPublished,
                    },
                  },
                })
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Published',
                  String(isPublished),
                ])
              }}
              handleResolveFeedback={async (
                feedbackId: number,
                isResolved: boolean
              ) => {
                await resolveFeedback({
                  variables: {
                    id: feedbackId,
                    isResolved,
                    liveQuizId: quizId,
                  },
                  optimisticResponse: {
                    resolveFeedback: {
                      __typename: 'Feedback',
                      id: feedbackId,
                      isResolved,
                    },
                  },
                })
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Resolved',
                  String(isResolved),
                ])
              }}
              handleRespondToFeedback={async (
                feedbackId: number,
                response: string
              ) => {
                await respondToFeedback({
                  variables: {
                    id: feedbackId,
                    responseContent: response,
                    liveQuizId: quizId,
                  },
                })
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Response Added',
                  response.length,
                ])
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
              await changeQuizSettings({
                variables: {
                  id: quizId,
                  isConfusionFeedbackEnabled: !isConfusionFeedbackEnabled,
                },
              })
              push([
                'trackEvent',
                'Running Live Quiz',
                'Confusion Feedback Toggled',
                String(!isConfusionFeedbackEnabled),
              ])
            }}
            label={t('manage.cockpit.activateFeedback')}
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
              await changeQuizSettings({
                variables: {
                  id: quizId,
                  isModerationEnabled: false,
                },
              })
              push([
                'trackEvent',
                'Running Live Quiz',
                'Feedback Moderation Disabled With Auto-Publish',
              ])
              setShowModerationModal(false)
            } finally {
              setModerationChangeLoading(false)
            }
          }}
          unpublishedCount={
            feedbacks?.filter((f) => !f.isPublished).length || 0
          }
          loading={moderationChangeLoading}
        />
      )}
    </div>
  )
}

export default AudienceInteraction
