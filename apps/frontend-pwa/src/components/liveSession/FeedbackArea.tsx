import { useMutation, useQuery } from '@apollo/client'
import {
  AddConfusionTimestepDocument,
  CreateFeedbackDocument,
  GetFeedbacksDocument,
  UpvoteFeedbackDocument,
  VoteFeedbackResponseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { push } from '@socialgouv/matomo-next'
import { Button, H2, H3 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Field, Form, Formik } from 'formik'
import localForage from 'localforage'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Oval } from 'react-loader-spinner'

// TODO: replace debounce from loadaash with alternative implementation (possibly using ramda)
import _debounce from 'lodash/debounce'

import PublicFeedback from './PublicFeedback'
import Slider from './Slider'

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
  // const [newConfusionTS] = useMutation(AddConfusionTSMutation)

  const speedLabels = { min: 'slow', mid: 'optimal', max: 'fast' }
  const speedIcons = { min: '🐌', mid: '😀', max: '🦘' }
  const difficultyLabels = { min: 'easy', mid: 'optimal', max: 'hard' }
  const difficultyIcons = { min: '😴', mid: '😀', max: '🤯' }
  const sessionId = router.query.id as string

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
        }
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [])

  // TODO: fix localforage implementation - seems not to work at the moment
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

  const debouncedHandleNewConfusionTS = useCallback(
    _debounce(handleNewConfusionTS, 4000, { trailing: true }),
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

  if (feedbacksLoading || !feedbacksData?.feedbacks) {
    return <div>Loading...</div>
  }
  const openFeedbacks = feedbacksData?.feedbacks.filter(
    (feedback) => feedback?.isResolved === false
  )
  const resolvedFeedbacks = feedbacksData?.feedbacks.filter(
    (feedback) => feedback?.isResolved === true
  )

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
                  <Button.Label className="text-sm">Absenden</Button.Label>
                )}
              </Button>
            </Form>
          )}
        </Formik>
      </div>

      {/* // TODO: styling of confusion barometer (borders, etc); move component to design system if possible  */}
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
          />
        </div>
      </div>

      {feedbacksData?.feedbacks.length > 0 && (
        <div>
          {openFeedbacks.length > 0 && (
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

          {resolvedFeedbacks.length > 0 && (
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
