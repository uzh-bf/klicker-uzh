import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { FormattedMessage } from 'react-intl'
import { compose, withStateHandlers, withHandlers } from 'recompose'
import { Form, Button } from 'semantic-ui-react'

import { ConfusionSlider } from '../../../components/confusion'
import { Feedback } from '../../../components/feedbacks'

const propTypes = {
  active: PropTypes.bool,
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
  active: false,
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
            title={
              <h2>
                <FormattedMessage id="common.string.speed" defaultMessage="Speed" />
              </h2>
            }
            handleChange={newValue => handleConfusionSpeedChange(newValue)}
            handleChangeComplete={handleNewConfusionTS}
            labels={{ max: 'fast', mid: 'optimal', min: 'slow' }}
            max={10}
            min={-10}
            value={confusionSpeed}
          />

          <ConfusionSlider
            title={
              <h2>
                <FormattedMessage id="common.string.difficulty" defaultMessage="Difficulty" />
              </h2>
            }
            handleChange={newValue => handleConfusionDifficultyChange(newValue)}
            handleChangeComplete={handleNewConfusionTS}
            labels={{ max: 'hard', mid: 'optimal', min: 'easy' }}
            max={10}
            min={-10}
            value={confusionDifficulty}
          />
        </div>
      )}

      <div className="feedbacks">
        {isFeedbackChannelActive &&
          feedbacks &&
          feedbacks.map(({ id, content, votes }) => (
            <div key={id} className="feedback">
              <Feedback
                alreadyVoted={false}
                content={content}
                showDelete={false}
                votes={votes}
                updateVotes={() => null}
              />
            </div>
          ))}

        <Form className="newFeedback">
          <Form.Field>
            <label htmlFor="feedbackInput">
              <FormattedMessage
                defaultMessage="New Feedback"
                id="joinSession.newFeedbackInput.label"
              />
              <textarea
                name="feedbackInput"
                value={feedbackInputValue}
                onChange={handleFeedbackInputValueChange}
              />
            </label>
          </Form.Field>

          <Button
            primary
            disabled={!feedbackInputValue}
            floated="right"
            type="submit"
            onClick={handleNewFeedback}
          >
            <FormattedMessage defaultMessage="Submit" id="common.form.submit" />
          </Button>
        </Form>
      </div>

      <style jsx>{`
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
            margin-bottom: 0.5rem;
          }

          .feedback:not(:last-child) {
            margin-bottom: 0.5rem;
          }

          :global(form.newFeedback) {
            position: absolute;
            bottom: 1rem;
            left: 1rem;
            right: 1rem;

            textarea {
              height: 7rem;
            }
          }

          .actionButton {
            position: fixed;

            bottom: 2rem;
            right: 2rem;
          }

          .actionButton :global(button) {
            margin-right: 0;
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
      `}</style>
    </div>
  )
}

FeedbackArea.propTypes = propTypes
FeedbackArea.defaultProps = defaultProps

export default compose(
  withStateHandlers(
    {
      confusionDifficulty: 0,
      confusionSpeed: 0,
      feedbackInputValue: undefined,
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
    },
  ),
  withHandlers({
    handleNewConfusionTS: ({ confusionDifficulty, confusionSpeed, handleNewConfusionTS }) => () => {
      handleNewConfusionTS({ difficulty: confusionDifficulty, speed: confusionSpeed })
    },
    handleNewFeedback: ({
      feedbackInputValue,
      handleNewFeedback,
      handleFeedbackInputReset,
    }) => () => {
      handleFeedbackInputReset()
      handleNewFeedback({ content: feedbackInputValue })
    },
  }),
)(FeedbackArea)
