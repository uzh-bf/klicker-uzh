import { useMutation, useQuery } from '@apollo/client'
import {
  AddConfusionTimestepDocument,
  CreateFeedbackDocument,
  GetFeedbacksDocument,
  UpvoteFeedbackDocument,
  VoteFeedbackResponseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { push } from '@socialgouv/matomo-next'
import { Button, H2, H3, Slider } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Field, Form, Formik } from 'formik'
import localForage from 'localforage'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Oval } from 'react-loader-spinner'

import PublicFeedback from './PublicFeedback'

interface FeedbackAreaProps {
  isModerationEnabled?: boolean
}

const defaultProps = {
  isModerationEnabled: true,
}

function FeedbackArea({
  isModerationEnabled,
}: FeedbackAreaProps): React.ReactElement {
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

  const speedLabels = { min: 'slow', mid: 'optimal', max: 'fast' }
  const speedIcons = { min: '🐌', mid: '😀', max: '🦘' }
  const difficultyLabels = { min: 'easy', mid: 'optimal', max: 'hard' }
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

  // TODO: implement subscription on changing feedbacks
  // TODO: fix polling
  const {
    loading: feedbacksLoading,
    error: feedbacksError,
    data: feedbacksData,
  } = useQuery(GetFeedbacksDocument, {
    variables: {
      sessionId: router.query.id as string,
    },
    pollInterval: 10000,
    skip: !router.query.id,
  })

  const onAddFeedback = (input: string) => {
    createFeedback({
      variables: {
        sessionId: router.query.id as string,
        content: input,
        isPublished: !isModerationEnabled,
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
  const handleNewConfusionTS = async ({
    speed = 0,
    difficulty = 0,
  }): Promise<void> => {
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
  }

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
    []
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
      <H2>Feedback-Kanal</H2>

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
              <Field
                className="w-full mb-1 border-2 border-solid border-uzh-grey-80 rounded-md p-1.5 text-sm"
                component="textarea"
                rows="3"
                name="feedbackInput"
                placeholder="Feedback / Frage eingeben"
              />
              <Button
                className="float-right h-10 text-center items-center !w-30"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Button.Label>
                    <Oval
                      height={20}
                      width={20}
                      color="#0028a5"
                      visible={true}
                      ariaLabel="oval-loading"
                      secondaryColor="#99a9db"
                      strokeWidth={5}
                      strokeWidthSecondary={5}
                    />
                  </Button.Label>
                ) : (
                  <Button.Label>Absenden</Button.Label>
                )}
              </Button>
            </Form>
          )}
        </Formik>
      </div>

      <div className="mb-8 text-sm">
        <H3 className="-mb-4">Speed</H3>
        <div className="w-full mb-6">
          <Slider
            disabled={!isConfusionEnabled}
            handleChange={(newValue: any): Promise<void> =>
              onNewConfusionTS(newValue, 'speed')
            }
            icons={speedIcons}
            labels={speedLabels}
            value={confusionSpeed}
            rangeColorMap={RANGE_COLOR_MAP}
            borderColorMap={BORDER_COLOR_MAP}
            min={-2}
            max={2}
            step={1}
          />
        </div>

        <H3 className="-mb-4">Difficulty</H3>
        <div className="w-full mb-6">
          <Slider
            disabled={!isConfusionEnabled}
            handleChange={(newValue: any): Promise<void> =>
              onNewConfusionTS(newValue, 'difficulty')
            }
            icons={difficultyIcons}
            labels={difficultyLabels}
            value={confusionDifficulty}
            rangeColorMap={RANGE_COLOR_MAP}
            borderColorMap={BORDER_COLOR_MAP}
            min={-2}
            max={2}
            step={1}
          />
        </div>
      </div>

      {feedbacksData?.feedbacks.length > 0 && (
        <div>
          {openFeedbacks && openFeedbacks.length > 0 && (
            <div className="mb-8">
              <H3>Open Questions</H3>
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
              <H3>Resolved Questions</H3>
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

FeedbackArea.defaultProps = defaultProps

export default FeedbackArea
