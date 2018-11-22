import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { compose, withStateHandlers, withHandlers } from 'recompose'
import { Form, Button } from 'semantic-ui-react'

import { ConfusionSlider } from '../../confusion'
import { Feedback } from '../../feedbacks'

const propTypes = {
  active: PropTypes.bool.isRequired,
  confusionDifficulty: PropTypes.number.isRequired,
  confusionSpeed: PropTypes.number.isRequired,
  feedbackInputValue: PropTypes.string.isRequired,
  feedbacks: PropTypes.array,
  handleConfusionDifficultyChange: PropTypes.func.isRequired,
  handleConfusionSpeedChange: PropTypes.func.isRequired,
  handleFeedbackInputValueChange: PropTypes.func.isRequired,
  handleNewConfusionTS: PropTypes.func.isRequired,
  handleNewFeedback: PropTypes.func.isRequired,
  isConfusionBarometerActive: PropTypes.bool,
  isFeedbackChannelActive: PropTypes.bool,
}

const defaultProps = {
  feedbacks: [],
  isConfusionBarometerActive: false,
  isFeedbackChannelActive: false,
}

function FeedbackArea({
  active,
  isConfusionBarometerActive,
  confusionDifficulty,
  confusionSpeed,
  isFeedbackChannelActive,
  feedbacks,
  feedbackInputValue,
  handleFeedbackInputValueChange,
  handleConfusionDifficultyChange,
  handleConfusionSpeedChange,
  handleNewConfusionTS,
  handleNewFeedback,
}) {
  return (
    <div className={classNames('feedbackArea', { active })}>
      <h1 className="header">Feedback-Channel</h1>
      {isConfusionBarometerActive && (
        <div className="confusion">
          <ConfusionSlider
            handleChange={newValue => handleConfusionSpeedChange(newValue)}
            handleChangeComplete={handleNewConfusionTS}
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
            handleChange={newValue => handleConfusionDifficultyChange(newValue)}
            handleChangeComplete={handleNewConfusionTS}
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
                <textarea name="feedbackInput" value={feedbackInputValue} onChange={handleFeedbackInputValueChange} />
              </label>
            </Form.Field>

            <Button primary disabled={!feedbackInputValue} type="submit" onClick={handleNewFeedback}>
              <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
            </Button>
          </Form>
        )}
        {isFeedbackChannelActive && feedbacks && (
          <div className="existingFeedbacks">
            <h2>
              <FormattedMessage defaultMessage="All feedbacks" id="joinSession.allFeedbacks" />
            </h2>
            {feedbacks.map(({ id, content, votes }) => (
              <div className="feedback" key={id}>
                <Feedback
                  alreadyVoted={false}
                  content={content}
                  showDelete={false}
                  updateVotes={() => null}
                  votes={votes}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>
        {`
          @import 'src/theme';

          .feedbackArea {
            position: relative;

            display: none;
            flex-direction: column;

            padding: 1rem;
            padding-bottom: 15rem;

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
              }
            }
          }
        `}
      </style>
    </div>
  )
}

FeedbackArea.propTypes = propTypes
FeedbackArea.defaultProps = defaultProps

export default compose(
  withStateHandlers(
    ({ shortname, sessionId }) => {
      let confusion
      if (typeof window !== 'undefined') {
        try {
          if (window.sessionStorage) {
            confusion = JSON.parse(sessionStorage.getItem(`${shortname}-${sessionId}-confusion`))
          }
        } catch (e) {
          console.error(e)
        }
      }

      return {
        confusionDifficulty: confusion ? confusion.difficulty : undefined,
        confusionSpeed: confusion ? confusion.speed : undefined,
        feedbackInputValue: undefined,
      }
    },
    {
      handleConfusionDifficultyChange: () => confusionDifficulty => ({
        confusionDifficulty,
      }),
      handleConfusionSpeedChange: () => confusionSpeed => ({
        confusionSpeed,
      }),
      handleFeedbackInputReset: () => () => ({
        feedbackInputValue: '',
      }),
      handleFeedbackInputValueChange: () => e => ({
        feedbackInputValue: e.target.value,
      }),
    }
  ),
  withHandlers({
    handleNewConfusionTS: ({
      shortname,
      sessionId,
      confusionDifficulty,
      confusionSpeed,
      handleNewConfusionTS,
    }) => () => {
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
    },
    handleNewFeedback: ({ feedbackInputValue, handleNewFeedback, handleFeedbackInputReset }) => () => {
      handleFeedbackInputReset()
      handleNewFeedback({ content: feedbackInputValue })
    },
  })
)(FeedbackArea)
