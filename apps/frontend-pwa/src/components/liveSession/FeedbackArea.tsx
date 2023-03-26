import { useMutation, useQuery } from '@apollo/client'
import {
  AddConfusionTimestepDocument,
  CreateFeedbackDocument,
  FeedbackAddedDocument,
  FeedbackRemovedDocument,
  FeedbackUpdatedDocument,
  GetFeedbacksDocument,
  UpvoteFeedbackDocument,
  VoteFeedbackResponseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { push } from '@socialgouv/matomo-next'
import {
  Button,
  FormikTextareaField,
  H2,
  H3,
  Slider,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import localForage from 'localforage'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import PublicFeedback from './PublicFeedback'

function Subscriber({ subscribeToMore, sessionId }) {
  useEffect(() => {
    if (!sessionId) return

    const feedbackAdded = subscribeToMore({
      document: FeedbackAddedDocument,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        const newItem = subscriptionData.data.feedbackAdded
        if (prev.feedbacks?.map((item) => item.id).includes(newItem.id))
          return prev
        return { ...prev, feedbacks: [newItem, ...prev.feedbacks] }
      },
    })

    const feedbackRemoved = subscribeToMore({
      document: FeedbackRemovedDocument,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        const removedItem = subscriptionData.data.feedbackRemoved
        return {
          ...prev,
          feedbacks: prev.feedbacks?.filter((item) => item.id !== removedItem),
        }
      },
    })

    const feedbackUpdated = subscribeToMore({
      document: FeedbackUpdatedDocument,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        const updatedItem = subscriptionData.data.feedbackUpdated
        return {
          ...prev,
          feedbacks: prev.feedbacks?.map((item) => {
            if (item.id === updatedItem.id) return updatedItem
            return item
          }),
        }
      },
    })

    return () => {
      feedbackAdded && feedbackAdded()
      feedbackRemoved && feedbackRemoved()
      feedbackUpdated && feedbackUpdated()
    }
  }, [subscribeToMore, sessionId])

  return <div></div>
}

interface FeedbackAreaProps {
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
}

function FeedbackArea({
  isConfusionFeedbackEnabled,
  isLiveQAEnabled,
}: FeedbackAreaProps) {
  const t = useTranslations()

  const router = useRouter()
  const [upvoteFeedback] = useMutation(UpvoteFeedbackDocument)
  const [voteFeedbackResponse] = useMutation(VoteFeedbackResponseDocument)
  const [createFeedback] = useMutation(CreateFeedbackDocument)
  const [addConfusionTimestep] = useMutation(AddConfusionTimestepDocument)

  const [confusionDifficulty, setConfusionDifficulty] = useState(0)
  const [confusionSpeed, setConfusionSpeed] = useState(0)
  const [isConfusionEnabled, setConfusionEnabled] = useState(true)
  const confusionButtonTimeout = useRef<any>()
  const confusionSubmissionTimeout = useRef<any>()

  const speedIcons = { min: '🐌', mid: '😀', max: '🦘' }
  const difficultyIcons = { min: '😴', mid: '😀', max: '🤯' }
  const sessionId = router.query.id as string
  const RANGE_COLOR_MAP: Record<string, string> = {
    '-2': 'bg-red-200',
    '-1': 'bg-yellow-200',
    '0': 'bg-green-200',
    '1': 'bg-yellow-200',
    '2': 'bg-red-200',
  }
  const BORDER_COLOR_MAP: Record<string, string> = {
    '-2': 'border-red-300',
    '-1': 'border-yellow-300',
    '0': 'border-green-300',
    '1': 'border-yellow-300',
    '2': 'border-red-300',
  }

  const {
    loading: feedbacksLoading,
    error: feedbacksError,
    data: feedbacksData,
    subscribeToMore,
  } = useQuery(GetFeedbacksDocument, {
    variables: {
      sessionId: router.query.id as string,
    },
    skip: !router.query.id,
  })

  const onAddFeedback = (input: string) => {
    if (!router.query.id) return
    createFeedback({
      variables: {
        sessionId: router.query.id as string,
        content: input,
      },
    })
  }

  const onUpvoteFeedback = (id: number, change: number) => {
    upvoteFeedback({ variables: { feedbackId: id, increment: change } })
  }

  const onReactToFeedbackResponse = (
    id: number,
    upvoteChange: number,
    downvoteChange: number
  ) => {
    voteFeedbackResponse({
      variables: {
        id: id,
        incrementUpvote: upvoteChange,
        incrementDownvote: downvoteChange,
      },
    })
  }

  useEffect((): void => {
    const exec = async () => {
      try {
        const confusion: any = await localForage.getItem(
          `${sessionId}-confusion`
        )
        if (confusion) {
          setConfusionSpeed(confusion.prevSpeed)
          setConfusionDifficulty(confusion.prevDifficulty)

          // if the time since the last confusion is less than 1 minutes, the confusion sliders will also be disabled on page reload
          const timeToNextVote =
            60000 - dayjs().diff(dayjs(confusion.prevTimestamp))

          // if the last vote was less than 58 seconds ago, the slider will still be disabled until the minute is completed
          if (timeToNextVote > 2000) {
            if (confusionButtonTimeout.current) {
              clearTimeout(confusionButtonTimeout.current)
            }
            setConfusionEnabled(false)
            confusionButtonTimeout.current = setTimeout(
              setConfusionEnabled,
              timeToNextVote,
              true
            )
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [sessionId])

  // handle creation of a new confusion timestep with debounce for aggregation
  const handleNewConfusionTS = useCallback(
    async ({ speed = 0, difficulty = 0 }): Promise<void> => {
      try {
        addConfusionTimestep({
          variables: {
            sessionId: sessionId,
            difficulty: difficulty,
            speed: speed,
          },
        })

        localForage.setItem(`${sessionId}-confusion`, {
          prevSpeed: speed,
          prevDifficulty: difficulty,
          prevTimestamp: dayjs().format(),
        })
        push([
          'trackEvent',
          'Join Session',
          'Confusion Interacted',
          `speed=${speed}, difficulty=${difficulty}`,
        ])
      } catch ({ message }) {
        console.error(message)
      } finally {
        // disable confusion voting for 1 minute
        setConfusionEnabled(false)
        if (confusionButtonTimeout.current) {
          clearTimeout(confusionButtonTimeout.current)
        }
        confusionButtonTimeout.current = setTimeout(
          setConfusionEnabled,
          60000,
          true
        )
      }
    },
    [addConfusionTimestep, sessionId]
  )

  // custom implementation of confusion feedback debouncing
  const debouncedHandleNewConfusionTS = useCallback(
    ({ speed, difficulty }: { speed: number; difficulty: number }) => {
      clearTimeout(confusionSubmissionTimeout.current)
      confusionSubmissionTimeout.current = setTimeout(
        handleNewConfusionTS,
        4000,
        {
          speed,
          difficulty,
        }
      )
    },
    [handleNewConfusionTS]
  )

  const onNewConfusionTS = async (newValue: any, selector: string) => {
    // send the new confusion entry to the server
    if (selector === 'speed') {
      setConfusionSpeed(newValue)
    } else if (selector === 'difficulty') {
      setConfusionDifficulty(newValue)
    }

    debouncedHandleNewConfusionTS({
      speed: selector === 'speed' ? newValue : confusionSpeed,
      difficulty: selector === 'difficulty' ? newValue : confusionDifficulty,
    })
  }

  const openFeedbacks = useMemo(
    () =>
      feedbacksData?.feedbacks?.filter(
        (feedback) => feedback?.isResolved === false
      ),
    [feedbacksData]
  )

  const resolvedFeedbacks = useMemo(
    () =>
      feedbacksData?.feedbacks?.filter(
        (feedback) => feedback?.isResolved === true
      ),
    [feedbacksData]
  )

  if (feedbacksLoading || !feedbacksData?.feedbacks) {
    return <div>Loading...</div>
  }

  return (
    <div className="w-full h-full">
      <H2>{t('pwa.feedbacks.title')}</H2>

      <Subscriber sessionId={sessionId} subscribeToMore={subscribeToMore} />

      {isLiveQAEnabled && (
        <div className="mb-8">
          <Formik
            initialValues={{ feedbackInput: '' }}
            onSubmit={(values, { setSubmitting }) => {
              if (values.feedbackInput !== '') {
                onAddFeedback(values.feedbackInput)
                values.feedbackInput = ''

                setTimeout(() => {
                  setSubmitting(false)
                }, 700)
              } else {
                setSubmitting(false)
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form>
                <FormikTextareaField
                  name="feedbackInput"
                  placeholder={t('pwa.feedbacks.feedbackPlaceholder')}
                  className={{
                    input:
                      'w-full mb-1 border-2 border-solid border-uzh-grey-80 rounded-md p-1.5 text-sm bg-white',
                    root: 'mb-1',
                  }}
                  component="textarea"
                  rows="3"
                  maxLength={500}
                  maxLengthLabel={t('shared.generic.characters')}
                />
                <Button
                  className={{
                    root: 'float-right h-10 text-center items-center !w-30',
                  }}
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Button.Label>{t('shared.generic.loading')}</Button.Label>
                  ) : (
                    <Button.Label>{t('shared.generic.send')}</Button.Label>
                  )}
                </Button>
              </Form>
            )}
          </Formik>
        </div>
      )}

      {isConfusionFeedbackEnabled && (
        <div className="mb-8 space-y-6 text-sm">
          <div className="">
            <H3 className={{ root: 'mb-0' }}>{t('pwa.feedbacks.speed')}</H3>
            <div className="w-full -mt-8">
              <Slider
                disabled={!isConfusionEnabled}
                handleChange={(newValue: any): Promise<void> =>
                  onNewConfusionTS(newValue, 'speed')
                }
                icons={speedIcons}
                value={confusionSpeed}
                rangeColorMap={RANGE_COLOR_MAP}
                borderColorMap={BORDER_COLOR_MAP}
                min={-2}
                max={2}
                step={1}
              />
            </div>
          </div>
          <div>
            <H3 className={{ root: 'mb-0' }}>
              {t('pwa.feedbacks.difficulty')}
            </H3>
            <div className="w-full -mt-5">
              <Slider
                disabled={!isConfusionEnabled}
                handleChange={(newValue: any): Promise<void> =>
                  onNewConfusionTS(newValue, 'difficulty')
                }
                icons={difficultyIcons}
                value={confusionDifficulty}
                rangeColorMap={RANGE_COLOR_MAP}
                borderColorMap={BORDER_COLOR_MAP}
                min={-2}
                max={2}
                step={1}
              />
            </div>
          </div>
        </div>
      )}

      {isLiveQAEnabled && feedbacksData?.feedbacks.length > 0 && (
        <div>
          {openFeedbacks && openFeedbacks.length > 0 && (
            <div className="mb-8">
              <H3>{t('pwa.feedbacks.openQuestions')}</H3>
              {openFeedbacks.map((feedback) =>
                feedback ? (
                  <PublicFeedback
                    key={feedback.content}
                    feedback={feedback}
                    onUpvoteFeedback={onUpvoteFeedback}
                    onReactToFeedbackResponse={onReactToFeedbackResponse}
                  />
                ) : null
              )}
            </div>
          )}

          {resolvedFeedbacks && resolvedFeedbacks.length > 0 && (
            <div className="mb-4">
              <H3>{t('pwa.feedbacks.resolvedQuestions')}</H3>
              {resolvedFeedbacks
                .sort((feedback1, feedback2) =>
                  feedback1 && feedback2
                    ? dayjs(feedback2.resolvedAt).diff(
                        dayjs(feedback1.resolvedAt)
                      )
                    : 0
                )
                .map((feedback) =>
                  feedback ? (
                    <PublicFeedback
                      key={feedback.content}
                      feedback={feedback}
                      onUpvoteFeedback={onUpvoteFeedback}
                      onReactToFeedbackResponse={onReactToFeedbackResponse}
                    />
                  ) : null
                )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FeedbackArea
