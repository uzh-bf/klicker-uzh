import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { compose, withHandlers, withState, withProps, branch, renderComponent } from 'recompose'
import { Menu, Button, Input } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import _range from 'lodash/range'

import { pageWithIntl, withData } from '../lib'
import { JoinSessionQuery } from '../graphql/queries'
import { Collapser } from '../components/common'
import { ConfusionSlider } from '../components/confusion'
import { Feedback } from '../components/feedbacks'
import { StudentLayout } from '../components/layouts'
import { SCAnswerOptions, FREEAnswerOptions } from '../components/questionTypes'

const propTypes = {
  addNewFeedback: PropTypes.func.isRequired,
  addNewFeedbackMode: PropTypes.bool.isRequired,
  answerSliderValue: PropTypes.number.isRequired,
  feedbacks: PropTypes.arrayOf({
    content: PropTypes.string.isRequired,
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
  feedbacks: [],
  dataQuestion: {
    restrictions: [],
    tpye: 'NONE',
  },
}

const Join = ({
  intl,
  feedbacks,
  activeQuestions,
  shortname,
  addNewFeedback,
  addNewFeedbackMode,
  answerSliderValue,
  dataQuestion,
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
  handleQuestionActiveOptionsChange,
  handleNewFeedbackInputChange,
  newFeedbackInput,
  handleToggleSidebarVisible,
  activeQuestionIndex,
  setActiveQuestionIndex,
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

  const activeQuestion = activeQuestions[activeQuestionIndex]

  return (
    <StudentLayout
      pageTitle={`Join ${shortname}`}
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
              {activeQuestion.description}
            </Collapser>
          </div>

          <div className="options">
            {(() => {
              if (activeQuestion.type === 'SC') {
                return (
                  <SCAnswerOptions
                    activeOptions={questionActiveOption}
                    options={activeQuestion.options.choices}
                    handleOptionClick={handleQuestionActiveOptionsChange}
                  />
                )
              }

              if (activeQuestion.type === 'FREE') {
                return (
                  <FREEAnswerOptions
                    handleChange={handleAnswerSliderChange}
                    options={activeQuestion.options}
                    value={answerSliderValue}
                  />
                )
              }

              return null
            })()}
          </div>

          <div className="actionButton">
            <Button primary className="submitButton">
              <FormattedMessage
                id="common.string.send"
                defaultMessage="Send"
                onClick={() => null}
              />
            </Button>
          </div>

          {activeQuestions.length > 1 && (
            <Menu text>
              {_range(activeQuestions.length).map(index => (
                <Menu.Item
                  active={index === activeQuestionIndex}
                  onClick={() => setActiveQuestionIndex(index)}
                >
                  {index}
                </Menu.Item>
              ))}
            </Menu>
          )}
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
            {feedbacks.map(({ content, votes }, index) => (
              <div key={index} className="feedback">
                <Feedback
                  alreadyVoted={false}
                  content={content}
                  showDelete={false}
                  votes={votes}
                  updateVotes={() => null}
                />
              </div>
            ))}
            {addNewFeedbackMode && (
              <div className="newFeedbackRow">
                <Input defaultValue={newFeedbackInput} onChange={handleNewFeedbackInputChange} />
                <Button onClick={handleFeedbackModeChange}>Cancel</Button>
                <Button onClick={() => null}>Submit</Button>
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

Join.propTypes = propTypes
Join.defaultProps = defaultProps

export default compose(
  withData,
  pageWithIntl,
  withState('answerSliderValue', 'setAnswerSliderValue', 500),
  withState('feedbackDifficulty', 'setFeedbackDifficulty', null),
  withState('feedbackSpeed', 'setFeedbackSpeed', null),
  withState('questionCollapsed', 'setQuestionCollapsed', true),
  withState('addNewFeedbackMode', 'setNewFeedbackMode', false),
  withState('questionActiveOptions', 'setQuestionActiveOptions', []),
  withState('sidebarActiveItem', 'setSidebarActiveItem', 'activeQuestion'),
  withState('newFeedbackInput', 'setNewFeedbackInput', ''),
  withState('sidebarVisible', 'setSidebarVisible', false),
  withState('activeQuestionIndex', 'setActiveQuestionIndex', 0),
  withHandlers({
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
    handleQuestionActiveOptionsChange: ({ setQuestionActiveOptions }) => option => () => {
      setQuestionActiveOptions([option])
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
  }),
  graphql(JoinSessionQuery, {
    options: props => ({ variables: { shortname: props.url.query.shortname } }),
  }),
  branch(({ loading }) => loading, renderComponent(<div />)),
  withProps(({ data: { joinSession }, url }) => ({
    ...joinSession,
    shortname: url.query.shortname,
  })),
)(Join)
