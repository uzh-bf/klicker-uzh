import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { compose, withState, withHandlers } from 'recompose'
import { Button } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'

import { pageWithIntl, withData } from '../../lib'

import { Collapser } from '../../components/common'
import { ConfusionSlider } from '../../components/confusion'
import { Feedback } from '../../components/feedbacks'
import { StudentLayout } from '../../components/layouts'
import { SCAnswerOptions } from '../../components/questionTypes'

const propTypes = {
  feedbackDifficulty: PropTypes.oneOfType(PropTypes.number, null).isRequired,
  feedbackSpeed: PropTypes.oneOfType(PropTypes.number, null).isRequired,
  handleFeedbackDifficultyChange: PropTypes.func.isRequired,
  handleFeedbackSpeedChange: PropTypes.func.isRequired,
  handleQuestionActiveOptionChange: PropTypes.func.isRequired,
  handleQuestionCollapsedToggle: PropTypes.func.isRequired,
  handleSidebarActiveItemChange: PropTypes.func.isRequired,
  handleToggleSidebarVisible: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  questionActiveOption: PropTypes.number.isRequired,
  questionCollapsed: PropTypes.bool.isRequired,
  sidebarActiveItem: PropTypes.string.isRequired,
  sidebarVisible: PropTypes.bool.isRequired,
}

const Session = ({
  intl,
  questionCollapsed,
  feedbackDifficulty,
  feedbackSpeed,
  questionActiveOption,
  sidebarActiveItem,
  sidebarVisible,
  handleQuestionCollapsedToggle,
  handleFeedbackDifficultyChange,
  handleFeedbackSpeedChange,
  handleSidebarActiveItemChange,
  handleQuestionActiveOptionChange,
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
            <div className="feedback">
              <Feedback content="hello world" showDelete={false} votes={100} />
            </div>
            <div className="feedback">
              <Feedback content="blablbla" showDelete={false} votes={50} />
            </div>
            <div className="feedback">
              <Feedback content="hello" showDelete={false} votes={25} />
            </div>
            <div className="feedback">
              <Feedback content="hooi" showDelete={false} votes={10} />
            </div>
          </div>

          <div className="actionButton">
            <Button circular primary icon="plus" size="large" />
          </div>
        </div>

        <style jsx>{`
          @import 'src/_theme';

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

export default compose(
  withData,
  pageWithIntl,
  withState('questionCollapsed', 'setQuestionCollapsed', true),
  withState('feedbackDifficulty', 'setFeedbackDifficulty', null),
  withState('feedbackSpeed', 'setFeedbackSpeed', null),
  withState('questionActiveOption', 'setQuestionActiveOption', -1),
  withState('sidebarActiveItem', 'setSidebarActiveItem', 'activeQuestion'),
  withState('sidebarVisible', 'setSidebarVisible', false),
  withHandlers({
    // handle value change for difficulty
    handleFeedbackDifficultyChange: ({ setFeedbackDifficulty }) => newValue =>
      setFeedbackDifficulty(newValue),

    // handle value change for speed
    handleFeedbackSpeedChange: ({ setFeedbackSpeed }) => newValue => setFeedbackSpeed(newValue),

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
  }),
)(Session)
