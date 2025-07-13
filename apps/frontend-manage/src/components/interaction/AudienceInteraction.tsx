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
  isGamificationEnabled: boolean
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
  isGamificationEnabled,
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

  const [changeQuizSettings] = useMutation(ChangeLiveQuizSettingsDocument)
  const [publishFeedback] = useMutation(PublishFeedbackDocument)
  const [pinFeedback] = useMutation(PinFeedbackDocument)
  const [resolveFeedback] = useMutation(ResolveFeedbackDocument)
  const [deleteFeedback] = useMutation(DeleteFeedbackDocument)
  const [deleteFeedbackResponse] = useMutation(DeleteFeedbackResponseDocument)
  const [respondToFeedback] = useMutation(RespondToFeedbackDocument)

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
              onCheckedChange={(): void => {
                changeQuizSettings({
                  variables: {
                    id: quizId,
                    isLiveQAEnabled: !isLiveQAEnabled,
                  },
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
              onCheckedChange={(): void => {
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
                changeQuizSettings({
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
              handleDeleteFeedback={(feedbackId: number): void => {
                deleteFeedback({
                  variables: { id: feedbackId, liveQuizId: quizId },
                  optimisticResponse: {
                    deleteFeedback: {
                      id: feedbackId,
                      __typename: 'Feedback',
                    },
                  },
                  update(cache, res) {
                    const removedFeedback = res.data?.deleteFeedback
                    const data = cache.readQuery({
                      query: GetCockpitQuizDocument,
                      variables: { id: quizId },
                    })

                    if (data?.cockpitQuiz && removedFeedback) {
                      cache.writeQuery({
                        query: GetCockpitQuizDocument,
                        variables: { id: quizId },
                        data: {
                          cockpitQuiz: {
                            ...data.cockpitQuiz,
                            feedbacks:
                              data.cockpitQuiz.feedbacks?.filter(
                                (feedback) => feedback.id !== removedFeedback.id
                              ) ?? [],
                          },
                        },
                      })
                    }
                  },
                })
                push(['trackEvent', 'Running Live Quiz', 'Feedback Deleted'])
              }}
              handleDeleteFeedbackResponse={(responseId: number) => {
                deleteFeedbackResponse({
                  variables: { id: responseId, liveQuizId: quizId },
                  update(cache, res) {
                    const updatedFeedback = res.data?.deleteFeedbackResponse
                    const data = cache.readQuery({
                      query: GetCockpitQuizDocument,
                      variables: { id: quizId },
                    })

                    if (data?.cockpitQuiz && updatedFeedback) {
                      cache.writeQuery({
                        query: GetCockpitQuizDocument,
                        variables: { id: quizId },
                        data: {
                          cockpitQuiz: {
                            ...data.cockpitQuiz,
                            feedbacks: data.cockpitQuiz.feedbacks?.map(
                              (feedback) => {
                                if (feedback.id === updatedFeedback.id) {
                                  return updatedFeedback
                                }
                                return feedback
                              }
                            ),
                          },
                        },
                      })
                    }
                  },
                })

                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Response Deleted',
                ])
              }}
              handlePinFeedback={(feedbackId: number, isPinned: boolean) => {
                pinFeedback({
                  variables: {
                    id: feedbackId,
                    isPinned,
                    liveQuizId: quizId,
                  },
                })
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Pinned',
                  String(isPinned),
                ])
              }}
              handlePublishFeedback={(
                feedbackId: number,
                isPublished: boolean
              ) => {
                publishFeedback({
                  variables: {
                    id: feedbackId,
                    isPublished,
                    liveQuizId: quizId,
                  },
                })
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Published',
                  String(isPublished),
                ])
              }}
              handleResolveFeedback={(
                feedbackId: number,
                isResolved: boolean
              ) => {
                resolveFeedback({
                  variables: {
                    id: feedbackId,
                    isResolved,
                    liveQuizId: quizId,
                  },
                })
                push([
                  'trackEvent',
                  'Running Live Quiz',
                  'Feedback Resolved',
                  String(isResolved),
                ])
              }}
              handleRespondToFeedback={(
                feedbackId: number,
                response: string
              ) => {
                respondToFeedback({
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
            onCheckedChange={(): void => {
              changeQuizSettings({
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
