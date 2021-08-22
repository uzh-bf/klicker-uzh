import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { Form, Button } from 'semantic-ui-react'

import ConfusionSlider from '../../interaction/confusion/ConfusionSlider'
import Feedback from '../../interaction/feedbacks/Feedback'

interface Props {
  active: boolean
  isConfusionBarometerActive: boolean
  isFeedbackChannelActive: boolean
  feedbacks?: any[]
  handleNewConfusionTS: any
  handleNewFeedback: any
  shortname: string
  sessionId: string
}

const defaultProps = {
  feedbacks: [],
  isConfusionBarometerActive: false,
  isFeedbackChannelActive: false,
}

function FeedbackArea({
  active,
  isConfusionBarometerActive,
  isFeedbackChannelActive,
  feedbacks,
  handleNewConfusionTS,
  handleNewFeedback,
  shortname,
  sessionId,
}: Props): React.ReactElement {
  const [confusionDifficulty, setConfusionDifficulty] = useState()
  const [confusionSpeed, setConfusionSpeed] = useState()
  const [feedbackInputValue, setFeedbackInputValue] = useState('')

  useEffect((): void => {
    try {
      if (window.sessionStorage) {
        const confusion = JSON.parse(sessionStorage.getItem(`${shortname}-${sessionId}-confusion`))
        setConfusionDifficulty(confusion.confusionDifficulty)
        setConfusionSpeed(confusion.confusionSpeed)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const onNewConfusionTS = (): void => {
    // send the new confusion entry to the server
    handleNewConfusionTS({
      difficulty: confusionDifficulty,
      speed: confusionSpeed,
    })

    // update the confusion cookie
    try {
      if (window.sessionStorage) {
        sessionStorage.setItem(
          `${shortname}-${sessionId}-confusion`,
          JSON.stringify({
            difficulty: confusionDifficulty,
            speed: confusionSpeed,
            timestamp: dayjs().unix(),
          })
        )
      }
    } catch (e) {
      console.error(e)
    }
  }

  const onNewFeedback = (): void => {
    setFeedbackInputValue('')
    handleNewFeedback({ content: feedbackInputValue })
  }

  return (
    <div className={clsx('feedbackArea', { active })}>
      <h1 className="header">Feedback-Channel</h1>

      {isConfusionBarometerActive && (
        <div className="confusion">
          <ConfusionSlider
            handleChange={(newValue): void => setConfusionSpeed(newValue)}
            handleChangeComplete={onNewConfusionTS}
            labels={{ max: 'fast', mid: 'optimal', min: 'slow' }}
            max={5}
            min={-5}
            title={
              <h2 className="sectionTitle">
                <FormattedMessage defaultMessage="Speed" id="common.string.speed" />
              </h2>
            }
            value={confusionSpeed}
          />

          <ConfusionSlider
            handleChange={(newValue): void => setConfusionDifficulty(newValue)}
            handleChangeComplete={onNewConfusionTS}
            labels={{ max: 'hard', mid: 'optimal', min: 'easy' }}
            max={5}
            min={-5}
            title={
              <h2 className="sectionTitle">
                <FormattedMessage defaultMessage="Difficulty" id="common.string.difficulty" />
              </h2>
            }
            value={confusionDifficulty}
          />
        </div>
      )}

      <div className="feedbacks">
        {isFeedbackChannelActive && (
          <Form className="newFeedback">
            <Form.Field>
              <label htmlFor="feedbackInput">
                <h2 className="sectionTitle">
                  <FormattedMessage defaultMessage="New open feedback" id="joinSession.newFeedbackInput.label" />
                </h2>
                <textarea
                  name="feedbackInput"
                  value={feedbackInputValue}
                  onChange={(e): void => setFeedbackInputValue(e.target.value)}
                />
              </label>
            </Form.Field>

            <Button primary disabled={!feedbackInputValue} type="submit" onClick={onNewFeedback}>
              <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
            </Button>
          </Form>
        )}
        {isFeedbackChannelActive && feedbacks && feedbacks.length > 0 && (
          <div className="existingFeedbacks">
            <h2>
              <FormattedMessage defaultMessage="All feedbacks" id="joinSession.allFeedbacks" />
            </h2>

            {feedbacks.map(
              ({ id, content, votes }): React.ReactElement => (
                <div className="feedback" key={id}>
                  <Feedback
                    alreadyVoted={false}
                    content={content}
                    showDelete={false}
                    updateVotes={(): void => null}
                    votes={votes}
                  />
                </div>
              )
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @import 'src/theme';

        .feedbackArea {
          position: relative;

          display: none;
          flex-direction: column;

          padding: 1rem;
          padding-bottom: 5rem;

          flex: 1;

          background-color: white;

          &.active {
            display: flex;
          }

          .header {
            display: none;
          }

          .confusion {
            background-color: $color-primary-20p;
            border: 1px solid $color-primary;
            padding: 1rem;

            > :global(*:first-child) {
              margin-bottom: 5rem;
            }

            > :global(*:last-child) {
              margin-bottom: 3rem;
            }
          }

          .feedbacks {
            flex: 1;
            margin-top: 1rem;

            h2 {
              font-size: 1.1rem !important;
              margin-bottom: 0.5rem;
            }

            :global(form.newFeedback) {
              margin-bottom: 0;

              textarea {
                height: 6rem;
              }

              :global(.field) {
                margin-bottom: 0.5rem;
              }
            }

            .existingFeedbacks {
              margin-top: 1rem;

              .feedback:not(:last-child) {
                margin-bottom: 0.3rem;
              }
            }
          }

          .sectionTitle {
            font-weight: bold;
            font-size: 1rem;
            margin-bottom: 0.5rem;
          }

          @include desktop-tablet-only {
            display: flex;

            border: 1px solid $color-primary;
            margin-left: 0.25rem;

            .header {
              display: block;
              font-size: 1.2rem !important;
            }
          }
        }
      `}</style>
    </div>
  )
}

FeedbackArea.defaultProps = defaultProps

export default FeedbackArea
