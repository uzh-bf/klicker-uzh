import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { compose, withHandlers, withProps, withState } from 'recompose'
import { Button, Input } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'

import { pageWithIntl, withData } from '../../lib'

import { Collapser } from '../../components/common'
import { ConfusionSlider } from '../../components/confusion'
import { Feedback } from '../../components/feedbacks'
import { StudentLayout } from '../../components/layouts'
import { SCAnswerOptions } from '../../components/questionTypes'

const propTypes = {
  addNewFeedback: PropTypes.func.isRequired,
  addNewFeedbackMode: PropTypes.bool.isRequired,
  dataFeedbacks: PropTypes.arrayOf({
    content: PropTypes.string.isRequired,
    showDelete: PropTypes.bool.isRequired,
    votes: PropTypes.number.isRequired,
  }),
  feedbackDifficulty: PropTypes.oneOfType(PropTypes.number, null).isRequired,
  feedbackSpeed: PropTypes.oneOfType(PropTypes.number, null).isRequired,
  handleFeedbackDifficultyChange: PropTypes.func.isRequired,
  handleFeedbackModeChange: PropTypes.func.isRequired,
  handleFeedbackSpeedChange: PropTypes.func.isRequired,
  handleNewFeedbackInput: PropTypes.func.isRequired,
  handleQuestionActiveOptionChange: PropTypes.func.isRequired,
  handleQuestionCollapsedToggle: PropTypes.func.isRequired,
  handleSidebarActiveItemChange: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  newFeedbackInput: PropTypes.string.isRequired,
  questionActiveOption: PropTypes.number.isRequired,
  questionCollapsed: PropTypes.bool.isRequired,
  sidebarActiveItem: PropTypes.string.isRequired,
}

const defaultProps = {
  dataFeedbacks: [],
}

const Session = ({
                   addNewFeedback,
                   addNewFeedbackMode,
                   dataFeedbacks,
                   intl,
                   questionCollapsed,
                   feedbackDifficulty,
                   feedbackSpeed,
                   questionActiveOption,
                   sidebarActiveItem,
                   handleFeedbackModeChange,
                   handleQuestionCollapsedToggle,
                   handleFeedbackDifficultyChange,
                   handleFeedbackSpeedChange,
                   handleSidebarActiveItemChange,
                   handleQuestionActiveOptionChange,
                   handleNewFeedbackInputChange,
                   newFeedbackInput,
                 }) => {
  const title =
    sidebarActiveItem === 'activeQuestion'
      ? intl.formatMessage({
        defaultMessage: 'Active Question',
        id: 'student.activeQuestion.title',
      })
      : intl.formatMessage({
        defaultMessage: 'Feedback-Channel',
        id: 'student.feedbackChannel.title',
      })

  return (
    <StudentLayout
      pageTitle="Session #1762"
      sidebar={{
        activeItem: sidebarActiveItem,
        handleItemChange: handleSidebarActiveItemChange,
      }}
      title={title}
    >
      <div className="student">
        <div
          className={classNames('questionArea', {
            active: sidebarActiveItem === 'activeQuestion',
          })}
        >
          <div className="collapser">
            <Collapser
              collapsed={questionCollapsed}
              handleCollapseToggle={handleQuestionCollapsedToggle}
            >
              <p>
                hello this is a very short question that is getting longer and longer as we speak.
                it is in fact very very long. the end is even hidden at the beginning.
              </p>
              <p>
                wow, is this a long question. i could never have imagined seeing such a question.
              </p>
              <p>
                hello this is a very short question that is getting longer and longer as we speak.
                it is in fact very very long. the end is even hidden at the beginning.
              </p>
              <p>
                wow, is this a long question. i could never have imagined seeing such a question.
              </p>
            </Collapser>
          </div>

          <div className="options">
            <SCAnswerOptions
              activeOption={questionActiveOption}
              options={[
                { label: 'answer1' },
                { label: 'antwort 2' },
                { label: 'option 3' },
                { label: 'tschege' },
              ]}
              handleOptionClick={handleQuestionActiveOptionChange}
            />
          </div>

          <div className="actionButton">
            <Button primary className="submitButton">
              <FormattedMessage id="common.string.send" defaultMessage="Send" />
            </Button>
          </div>
        </div>

        <div
          className={classNames('feedbackArea', {
            active: sidebarActiveItem === 'feedbackChannel',
          })}
        >
          <div className="confusion">
            <ConfusionSlider
              title={
                <h2>
                  <FormattedMessage id="common.string.speed" defaultMessage="Speed" />
                </h2>
              }
              value={feedbackSpeed}
              handleChange={handleFeedbackSpeedChange}
            />

            <ConfusionSlider
              title={
                <h2>
                  <FormattedMessage id="common.string.difficulty" defaultMessage="Difficulty" />
                </h2>
              }
              value={feedbackDifficulty}
              handleChange={handleFeedbackDifficultyChange}
            />
          </div>

          <div className="feedbacks">
            {dataFeedbacks && dataFeedbacks.map(({ content, showDelete, votes }) => (
              <div className="feedback">
                <Feedback content={content} showDelete={showDelete} votes={votes} />
              </div>
            ))}
            {addNewFeedbackMode && (
              <div>
                <Input defaultValue={newFeedbackInput} onChange={handleNewFeedbackInputChange} />
                <Button onClick={handleFeedbackModeChange}>Cancel</Button>
                <Button onClick={() => addNewFeedback(newFeedbackInput)}>Submit</Button>
              </div>
            )}
          </div>

          {!addNewFeedbackMode && (
            <div className="actionButton">
              <Button
                circular
                primary
                icon="plus"
                onClick={handleFeedbackModeChange}
                size="large"
              />
            </div>
          )}
        </div>

        <style jsx>{`
          .student {
            display: flex;
          }

          .questionArea,
          .feedbackArea {
            display: none;
            flex-direction: column;

            flex: 1;

            padding: 0.5rem;
          }

          .questionArea.active,
          .feedbackArea.active {
            display: flex;
          }

          .confusion {
            margin-bottom: 0.5rem;
            padding: 0.5rem;

            border: 1px solid grey;
          }

          .feedback:not(:last-child) {
            margin-bottom: 0.5rem;
          }

          .actionButton {
            position: fixed;

            bottom: 1rem;
            right: 1rem;
          }

          .actionButton :global(button) {
            margin-right: 0;
          }

          @media all and (min-width: 768px) {
            .questionArea,
            .feedbackArea {
              display: flex;
            }

            .actionButton {
              align-self: flex-end;
              position: inherit;

              margin-top: 1rem;
            }
          }
        `}</style>
      </div>
    </StudentLayout>
  )
}

Session.propTypes = propTypes
Session.defaultProps = defaultProps

export default compose(
  withData,
  pageWithIntl,
  withState('addNewFeedbackMode', 'setNewFeedbackMode', false),
  withState('dataFeedbacks', 'setFeedbacks', [
    { content: 'Hallo du bist lustig!', showDelete: false, votes: 190 },
    { content: 'Gute Vorlesung', showDelete: false, votes: 63 },
    { content: 'bla bla bla', showDelete: false, votes: 131 },
    { content: 'Hahahahahaha', showDelete: false, votes: 10 },
  ]),
  withState('questionCollapsed', 'setQuestionCollapsed', true),
  withState('feedbackDifficulty', 'setFeedbackDifficulty', null),
  withState('feedbackSpeed', 'setFeedbackSpeed', null),
  withState('questionActiveOption', 'setQuestionActiveOption', -1),
  withState('sidebarActiveItem', 'setSidebarActiveItem', 'activeQuestion'),
  withState('newFeedbackInput', 'setNewFeedbackInput', ''),
  withHandlers({
    // handle adding a new feedback
    addNewFeedback: ({ dataFeedbacks, setFeedbacks }) => (newFeedback) => {
      const array = dataFeedbacks.slice()
      array.push({ content: newFeedback, showDelete: false, votes: 0 })
      setFeedbacks(array)
    },

    // handle value change for difficulty
    handleFeedbackDifficultyChange: ({ setFeedbackDifficulty }) => newValue =>
      setFeedbackDifficulty(newValue),

    // handle entering and leaving mode for adding new feedback
    handleFeedbackModeChange: ({ setNewFeedbackMode }) => () =>
      setNewFeedbackMode(prevState => !prevState),

    // handle value change for speed
    handleFeedbackSpeedChange: ({ setFeedbackSpeed }) => newValue => setFeedbackSpeed(newValue),

    // handle input change
    handleNewFeedbackInputChange: ({ setNewFeedbackInput }) => newInput => setNewFeedbackInput(newInput.target.value),

    // handle a change in the active answer option
    handleQuestionActiveOptionChange: ({ setQuestionActiveOption }) => option => () => {
      setQuestionActiveOption(option)
    },

    // handle collapsing and uncollapsing the question content
    handleQuestionCollapsedToggle: ({ setQuestionCollapsed }) => () =>
      setQuestionCollapsed(prevState => !prevState),

    // handle a change in the active sidebar item
    handleSidebarActiveItemChange: ({ setSidebarActiveItem }) => (sidebarItem) => {
      setSidebarActiveItem(sidebarItem)
    },
  }),
  withProps({
    // fake data the component is going to get
    data: {},
  }),
)(Session)
