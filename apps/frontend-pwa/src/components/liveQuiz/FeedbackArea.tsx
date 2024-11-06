import { useMutation, useQuery } from '@apollo/client'
import {
  AddConfusionTimestepDocument,
  CreateFeedbackDocument,
  GetFeedbacksDocument,
  UpvoteFeedbackDocument,
  VoteFeedbackResponseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
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
import FeedbackAreaSubscriber from './FeedbackAreaSubscriber'
import PublicFeedback from './PublicFeedback'

const speedIcons = { min: '🐌', mid: '😀', max: '🦘' }
const difficultyIcons = { min: '😴', mid: '😀', max: '🤯' }
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

function FeedbackArea({
  isConfusionFeedbackEnabled,
  isLiveQAEnabled,
}: {
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const quizId = router.query.id as string

  const [createFeedback] = useMutation(CreateFeedbackDocument)
  const [addConfusionTimestep] = useMutation(AddConfusionTimestepDocument)
  const [upvoteFeedback] = useMutation(UpvoteFeedbackDocument)
  const [voteFeedbackResponse] = useMutation(VoteFeedbackResponseDocument)

  const [confusionDifficulty, setConfusionDifficulty] = useState(0)
  const [confusionSpeed, setConfusionSpeed] = useState(0)
  const [isConfusionEnabled, setConfusionEnabled] = useState(true)
  const confusionButtonTimeout = useRef<any>()
  const confusionSubmissionTimeout = useRef<any>()

  const {
    loading: feedbacksLoading,
    data: feedbacksData,
    subscribeToMore,
  } = useQuery(GetFeedbacksDocument, {
    variables: {
      quizId: router.query.id as string,
    },
    skip: !router.query.id,
  })

  const onAddFeedback = async (input: string) => {
    if (!router.query.id) return
    await createFeedback({
      variables: {
        quizId: router.query.id as string,
        content: input,
      },
    })
  }

  const onUpvoteFeedback = async (id: number, change: number) => {
    await upvoteFeedback({ variables: { feedbackId: id, increment: change } })
  }

  const onReactToFeedbackResponse = async (
    id: number,
    upvoteChange: number,
    downvoteChange: number
  ) => {
    await voteFeedbackResponse({
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
        const confusion: any = await localForage.getItem(`${quizId}-confusion`)
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
  }, [quizId])

  // handle creation of a new confusion timestep with debounce for aggregation
  const handleNewConfusionTS = useCallback(
    async ({ speed = 0, difficulty = 0 }): Promise<void> => {
      try {
        addConfusionTimestep({
          variables: {
            quizId,
            difficulty: difficulty,
            speed: speed,
          },
        })

        localForage.setItem(`${quizId}-confusion`, {
          prevSpeed: speed,
          prevDifficulty: difficulty,
          prevTimestamp: dayjs().format(),
        })
        push([
          'trackEvent',
          'Join Live Quiz',
          'Confusion Interacted',
          `speed=${speed}, difficulty=${difficulty}`,
        ])
      } catch ({ message }: any) {
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
    [addConfusionTimestep, quizId]
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
    return <Loader />
  }

  return (
    <div className="h-full w-full">
      <H2>{t('pwa.feedbacks.title')}</H2>

      <FeedbackAreaSubscriber
        quizId={quizId}
        subscribeToMore={subscribeToMore}
      />

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
                      'border-uzh-grey-80 mb-1 w-full rounded-md border-2 border-solid bg-white p-1.5 text-sm',
                    root: 'mb-1',
                  }}
                  component="textarea"
                  rows="3"
                  maxLength={500}
                  maxLengthUnit={t('shared.generic.characters')}
                  data={{ cy: 'feedback-input' }}
                />
                <Button
                  className={{
                    root: '!w-30 float-right h-10 items-center text-center',
                  }}
                  type="submit"
                  disabled={isSubmitting}
                  data={{ cy: 'feedback-submit' }}
                >
                  {isSubmitting ? (
                    <Button.Label>
                      <Loader />
                    </Button.Label>
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
            <div className="-mt-8 w-full">
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
            <div className="-mt-5 w-full">
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
