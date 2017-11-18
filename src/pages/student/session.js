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
import { SCAnswerOptions, FREEAnswerOptions } from '../../components/questionTypes'

const propTypes = {
  addNewFeedback: PropTypes.func.isRequired,
  addNewFeedbackMode: PropTypes.bool.isRequired,
  answerSliderValue: PropTypes.number.isRequired,
  dataFeedbacks: PropTypes.arrayOf({
    content: PropTypes.string.isRequired,
    showDelete: PropTypes.bool.isRequired,
    votes: PropTypes.number.isRequired,
  }),
  dataQuestion: PropTypes.shape({
    restrictions: PropTypes.arrayOf({
      max: PropTypes.number,
      min: PropTypes.number,
    }),
    type: PropTypes.string,
  }),
  feedbackDifficulty: PropTypes.oneOfType(PropTypes.number, null).isRequired,
  feedbackSpeed: PropTypes.oneOfType(PropTypes.number, null).isRequired,
  handleAnswerSliderChange: PropTypes.func.isRequired,
  handleFeedbackDifficultyChange: PropTypes.func.isRequired,
  handleFeedbackModeChange: PropTypes.func.isRequired,
  handleFeedbackSpeedChange: PropTypes.func.isRequired,
  handleNewFeedbackInputChange: PropTypes.func.isRequired,
  handleQuestionActiveOptionChange: PropTypes.func.isRequired,
  handleQuestionCollapsedToggle: PropTypes.func.isRequired,
  handleSidebarActiveItemChange: PropTypes.func.isRequired,
  handleToggleSidebarVisible: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  newFeedbackInput: PropTypes.string.isRequired,
  questionActiveOption: PropTypes.number.isRequired,
  questionCollapsed: PropTypes.bool.isRequired,
  sidebarActiveItem: PropTypes.string.isRequired,
  sidebarVisible: PropTypes.bool.isRequired,
  updateVotes: PropTypes.func.isRequired,
}

const defaultProps = {
  dataFeedbacks: [],
  dataQuestion: {
    restrictions: [],
    tpye: 'NONE',
  },
}

const Session = ({
  addNewFeedback,
  addNewFeedbackMode,
  answerSliderValue,
  dataFeedbacks,
  dataQuestion,
  intl,
  questionCollapsed,
  feedbackDifficulty,
  feedbackSpeed,
  questionActiveOption,
  sidebarActiveItem,
  handleAnswerSliderChange,
  handleFeedbackModeChange,
  sidebarVisible,
  handleQuestionCollapsedToggle,
  handleFeedbackDifficultyChange,
  handleFeedbackSpeedChange,
  handleSidebarActiveItemChange,
  handleQuestionActiveOptionChange,
  handleNewFeedbackInputChange,
  newFeedbackInput,
  updateVotes,
  handleToggleSidebarVisible,
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
        handleSidebarActiveItemChange,
        handleToggleSidebarVisible,
        sidebarVisible,
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
            {dataQuestion.type === 'NONE' && (
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
            )}
            {dataQuestion.type === 'NUMBERS' && (
              <FREEAnswerOptions
                handleChange={handleAnswerSliderChange}
                options={{ restrictions: dataQuestion.restrictions }}
                value={answerSliderValue}
              />
            )}
          </div>

          <div className="actionButton">
            <Button primary className="submitButton">
              <FormattedMessage
                id="common.string.send"
                defaultMessage="Send"
                onClick={console.dir('Hello')}
              />
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
            {dataFeedbacks &&
              dataFeedbacks.map(({
 alreadyVoted, content, showDelete, votes,
}, index) => (
  <div className="feedback">
    <Feedback
      index={index}
      alreadyVoted={alreadyVoted}
      content={content}
      showDelete={showDelete}
      votes={votes}
      updateVotes={updateVotes}
    />
  </div>
              ))}
            {addNewFeedbackMode && (
              <div className="newFeedbackRow">
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
          @import 'src/theme';

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
  withState('answerSliderValue', 'setAnswerSliderValue', 500),
  withState('dataQuestion', 'setDataQuestions', { restrictions: [], type: 'NONE' }),
  withState('dataFeedbacks', 'setFeedbacks', [
    {
      alreadyVoted: false,
      content: 'Hallo du bist lustig!',
      showDelete: false,
      votes: 190,
    },
    {
      alreadyVotes: false,
      content: 'Gute Vorlesung',
      showDelete: false,
      votes: 63,
    },
    {
      alreadyVotes: false,
      content: 'bla bla bla',
      showDelete: false,
      votes: 131,
    },
    {
      alreadyVotes: false,
      content: 'Hahahahahaha',
      showDelete: false,
      votes: 10,
    },
  ]),
  withState('questionCollapsed', 'setQuestionCollapsed', true),
  withState('feedbackDifficulty', 'setFeedbackDifficulty', null),
  withState('feedbackSpeed', 'setFeedbackSpeed', null),
  withState('questionActiveOption', 'setQuestionActiveOption', -1),
  withState('sidebarActiveItem', 'setSidebarActiveItem', 'activeQuestion'),
  withState('newFeedbackInput', 'setNewFeedbackInput', ''),
  withState('sidebarVisible', 'setSidebarVisible', false),
  withHandlers({
    // handle adding a new feedback
    addNewFeedback: ({ dataFeedbacks, setFeedbacks }) => (newFeedback) => {
      const array = dataFeedbacks.slice()
      array.push({ content: newFeedback, showDelete: false, votes: 0 })
      setFeedbacks(array)
      // TODO change feedbackMode
    },

    // handle change of slider in answer section
    handleAnswerSliderChange: ({ setAnswerSliderValue }) => newValue =>
      setAnswerSliderValue(newValue),

    // handle value change for difficulty
    handleFeedbackDifficultyChange: ({ setFeedbackDifficulty }) => newValue =>
      setFeedbackDifficulty(newValue),

    // handle entering and leaving mode for adding new feedback
    handleFeedbackModeChange: ({ setNewFeedbackMode }) => () =>
      setNewFeedbackMode(prevState => !prevState),

    // handle value change for speed
    handleFeedbackSpeedChange: ({ setFeedbackSpeed }) => newValue => setFeedbackSpeed(newValue),

    // handle input change
    handleNewFeedbackInputChange: ({ setNewFeedbackInput }) => newInput =>
      setNewFeedbackInput(newInput.target.value),

    // handle a change in the active answer option
    handleQuestionActiveOptionChange: ({ setQuestionActiveOption }) => option => () => {
      setQuestionActiveOption(option)
    },

    // handle collapsing and uncollapsing the question content
    handleQuestionCollapsedToggle: ({ setQuestionCollapsed }) => () =>
      setQuestionCollapsed(prevState => !prevState),

    // handle a change in the active sidebar item
    handleSidebarActiveItemChange: ({
      setSidebarActiveItem,
      setSidebarVisible,
    }) => sidebarItem => () => {
      setSidebarActiveItem(sidebarItem)
      setSidebarVisible(false)
    },

    // handle toggling the sidebar visibility
    handleToggleSidebarVisible: ({ setSidebarVisible }) => () => {
      setSidebarVisible(prevState => !prevState)
    },

    // updating number of votes and update alreadyVoted variable of this item for this user
    updateVotes: ({ dataFeedbacks, setFeedbacks }) => (itemNumber) => {
      const array = dataFeedbacks.slice()
      if (!array[itemNumber].alreadyVoted) {
        array[itemNumber].votes += 1
        array[itemNumber].alreadyVoted = true
      } else {
        array[itemNumber].votes -= 1
        array[itemNumber].alreadyVoted = false
      }
      setFeedbacks(array)
    },
  }),
  withProps({
    // fake data the component is going to get
    data: {},
  }),
)(Session)
