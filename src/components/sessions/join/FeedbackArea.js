import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { FormattedMessage } from 'react-intl'
import { compose, withStateHandlers, withHandlers } from 'recompose'
import { Input, Button } from 'semantic-ui-react'
import _throttle from 'lodash/throttle'

import { ConfusionSlider } from '../../../components/confusion'
import { Feedback } from '../../../components/feedbacks'

const propTypes = {
  active: PropTypes.bool,
  confusionDifficulty: PropTypes.number.isRequired,
  confusionSpeed: PropTypes.number.isRequired,
  feedbackCreationMode: PropTypes.bool.isRequired,
  feedbackInputValue: PropTypes.string.isRequired,
  feedbacks: PropTypes.array,
  handleConfusionDifficultyChange: PropTypes.func.isRequired,
  handleConfusionSpeedChange: PropTypes.func.isRequired,
  handleFeedbackInputValueChange: PropTypes.func.isRequired,
  handleNewConfusionTS: PropTypes.func.isRequired,
  handleNewFeedback: PropTypes.func.isRequired,
  toggleFeedbackCreationMode: PropTypes.func.isRequired,
}

const defaultProps = {
  active: false,
  feedbacks: [],
}

function FeedbackArea({
  active,
  confusionDifficulty,
  confusionSpeed,
  feedbacks,
  feedbackCreationMode,
  feedbackInputValue,
  handleFeedbackInputValueChange,
  handleConfusionDifficultyChange,
  handleConfusionSpeedChange,
  handleNewConfusionTS,
  handleNewFeedback,
  toggleFeedbackCreationMode,
}) {
  return (
    <div className={classNames('feedbackArea', { active })}>
      <div className="confusion">
        <ConfusionSlider
          title={
            <h2>
              <FormattedMessage id="common.string.speed" defaultMessage="Speed" />
            </h2>
          }
          value={confusionSpeed}
          handleChange={newValue => handleConfusionSpeedChange(newValue)}
          handleChangeComplete={handleNewConfusionTS}
        />

        <ConfusionSlider
          title={
            <h2>
              <FormattedMessage id="common.string.difficulty" defaultMessage="Difficulty" />
            </h2>
          }
          value={confusionDifficulty}
          handleChange={newValue => handleConfusionDifficultyChange(newValue)}
          handleChangeComplete={handleNewConfusionTS}
        />
      </div>

      <div className="feedbacks">
        {feedbacks &&
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

        {feedbackCreationMode && (
          <div className="newFeedbackRow">
            <Input value={feedbackInputValue} onChange={handleFeedbackInputValueChange} />
            <Button onClick={toggleFeedbackCreationMode}>Cancel</Button>
            <Button onClick={handleNewFeedback}>Submit</Button>
          </div>
        )}
      </div>

      {!feedbackCreationMode && (
        <div className="actionButton">
          <Button circular primary icon="plus" onClick={toggleFeedbackCreationMode} size="large" />
        </div>
      )}

      <style jsx>{`
        @import 'src/theme';

        .feedbackArea {
          display: none;
          flex-direction: column;

          flex: 1;

          &.active {
            display: flex;
          }

          .confusion {
            margin-bottom: 0.5rem;
          }

          .confusion,
          .feedbacks {
            padding: 1rem;
          }

          .feedback:not(:last-child) {
            margin-bottom: 0.5rem;
          }

          .newFeedbackRow {
            display: flex;

            > .ui.input {
              // TODO formatting
            }

            > :global(button) {
              flex: 1 1 5%;
              align-self: flex-end;
            }
          }

          .actionButton {
            position: fixed;

            bottom: 1rem;
            right: 1rem;
          }

          .actionButton :global(button) {
            margin-right: 0;
          }

          @include desktop-tablet-only {
            display: flex;

            border: 1px solid $color-primary-10p;
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
      feedbackCreationMode: false,
      feedbackInputValue: undefined,
    },
    {
      handleConfusionDifficultyChange: () => confusionDifficulty => ({
        confusionDifficulty,
      }),
      handleConfusionSpeedChange: () => confusionSpeed => ({
        confusionSpeed,
      }),
      handleFeedbackInputValueChange: () => e => ({
        feedbackInputValue: e.target.value,
      }),
      toggleFeedbackCreationMode: ({ feedbackCreationMode }) => () => ({
        feedbackCreationMode: !feedbackCreationMode,
      }),
    },
  ),
  withHandlers({
    handleNewConfusionTS: ({ confusionDifficulty, confusionSpeed, handleNewConfusionTS }) => () => {
      handleNewConfusionTS({ difficulty: confusionDifficulty, speed: confusionSpeed })
    },
    handleNewFeedback: ({ feedbackInputValue, handleNewFeedback }) => () => {
      handleNewFeedback({ content: feedbackInputValue })
    },
  }),
)(FeedbackArea)
