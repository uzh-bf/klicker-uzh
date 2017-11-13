import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import _range from 'lodash/range'
import _without from 'lodash/without'
import { FormattedMessage } from 'react-intl'
import { compose, withStateHandlers, withHandlers } from 'recompose'

import { QuestionTypes } from '../../../constants'
import { ActionMenu, Collapser } from '../../common'
import { SCAnswerOptions, FREEAnswerOptions } from '../../questionTypes'

const propTypes = {
  active: PropTypes.bool,
  activeQuestion: PropTypes.number,
  handleActiveChoicesChange: PropTypes.func.isRequired,
  handleActiveQuestionChange: PropTypes.func.isRequired,
  handleFreeValueChange: PropTypes.func.isRequired,
  handleNewResponse: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  inputEmpty: PropTypes.bool.isRequired,
  inputValid: PropTypes.bool.isRequired,
  inputValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object])
    .isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  questions: PropTypes.array,
  remainingQuestions: PropTypes.array,
  toggleIsCollapsed: PropTypes.func.isRequired,
}

const defaultProps = {
  active: false,
  activeQuestion: 0,
  questions: [],
  remainingQuestions: [],
}

function QuestionArea({
  active,
  activeQuestion,
  remainingQuestions,
  isCollapsed,
  inputEmpty,
  inputValue,
  inputValid,
  questions,
  toggleIsCollapsed,
  handleActiveQuestionChange,
  handleActiveChoicesChange,
  handleFreeValueChange,
  handleSubmit,
}) {
  const currentQuestion = remainingQuestions.length > 0 && questions[activeQuestion]

  const messages = {
    [QuestionTypes.SC]: (
      <p>
        Please choose a <strong>single</strong> option below:
      </p>
    ),
    [QuestionTypes.MC]: (
      <p>
        Please choose <strong>one or multiple</strong> of the options below:
      </p>
    ),
    [QuestionTypes.FREE]:
      currentQuestion.type === QuestionTypes.FREE &&
      (currentQuestion.options.restrictions.type === 'RANGE' ? (
        <p>Please choose a number from the given range below:</p>
      ) : (
        <p>Please enter your response below:</p>
      )),
  }

  return (
    <div className={classNames('questionArea', { active })}>
      {(() => {
        if (remainingQuestions.length === 0) {
          return (
            <div className="padded">
              <FormattedMessage
                defaultMessage="You have completed all active questions."
                id="joinSession.allQuestionsCompleted"
              />
            </div>
          )
        }

        const { description, options, type } = currentQuestion

        return (
          <div>
            <div className="collapser">
              <Collapser collapsed={isCollapsed} handleCollapseToggle={toggleIsCollapsed}>
                {description}
              </Collapser>
            </div>

            <div className="options">
              {messages[type]}

              {(() => {
                if ([QuestionTypes.SC, QuestionTypes.MC].includes(type)) {
                  return (
                    <SCAnswerOptions
                      disabled={!remainingQuestions.includes(activeQuestion)}
                      onChange={handleActiveChoicesChange(type)}
                      options={options.choices}
                      value={inputValue}
                    />
                  )
                }

                if (type === QuestionTypes.FREE) {
                  return (
                    <FREEAnswerOptions
                      disabled={!remainingQuestions.includes(activeQuestion)}
                      onChange={handleFreeValueChange}
                      options={options}
                      value={inputValue}
                    />
                  )
                }

                return null
              })()}
            </div>

            <ActionMenu
              activeIndex={activeQuestion}
              items={_range(questions.length).map(index => ({
                done: !remainingQuestions.includes(index),
              }))}
              isSkipModeActive={inputEmpty}
              isSubmitDisabled={!inputEmpty && !inputValid}
              setActiveIndex={handleActiveQuestionChange}
              onSubmit={handleSubmit}
            />
          </div>
        )
      })()}

      <style jsx>{`
        @import 'src/theme';

        .questionArea {
          display: none;

          flex: 1;

          > div {
            display: flex;

            flex-direction: column;

            flex: 1;
          }

          &.active {
            display: flex;
          }

          .collapser,
          .options,
          .padded {
            padding: 1rem;
          }

          .collapser {
            flex: 0 0 auto;

            background-color: $color-primary-20p;
            border-bottom: 1px solid -color-primary-50p;
          }

          .options {
            flex: 1 1 50%;
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

QuestionArea.propTypes = propTypes
QuestionArea.defaultProps = defaultProps

export default compose(
  withStateHandlers(
    ({ questions }) => ({
      activeQuestion: 0,
      inputEmpty: true,
      inputValid: false,
      inputValue: undefined,
      isCollapsed: true,
      remainingQuestions: _range(questions.length),
    }),
    {
      handleActiveChoicesChange: ({ inputValue }) => (choice, type) => {
        const validateChoices = newValue =>
          (type === QuestionTypes.SC ? newValue.length === 1 : newValue.length > 0)

        if (inputValue) {
          // if the choice is already active, remove it
          if (inputValue.includes(choice)) {
            const newInputValue = _without(inputValue, choice)

            return {
              inputEmpty: newInputValue.length === 0,
              inputValid: validateChoices(newInputValue),
              inputValue: newInputValue,
            }
          }

          // else add it to the active choices
          const newInputValue = [...inputValue, choice]
          return {
            inputEmpty: false,
            inputValid: validateChoices(newInputValue),
            inputValue: newInputValue,
          }
        }

        // initialize the value with the first choice
        return {
          inputEmpty: false,
          inputValid: true,
          inputValue: [choice],
        }
      },
      handleActiveQuestionChange: () => activeQuestion => ({
        activeQuestion,
        inputEmpty: true,
        inputValid: false,
        inputValue: undefined,
      }),
      handleFreeValueChange: () => inputValue => ({
        inputEmpty: !inputValue || inputValue.length === 0,
        inputValid: !!inputValue,
        inputValue,
      }),
      handleSubmit: ({ activeQuestion, remainingQuestions }) => () => {
        // calculate the new indices of remaining questions
        const newRemaining = _without(remainingQuestions, activeQuestion)

        return {
          // activate the first question that is still remaining
          activeQuestion: newRemaining[0],
          inputEmpty: true,
          inputValid: false,
          inputValue: undefined,
          remainingQuestions: newRemaining,
        }
      },
      toggleIsCollapsed: ({ isCollapsed }) => () => ({ isCollapsed: !isCollapsed }),
    },
  ),
  withHandlers({
    handleActiveChoicesChange: ({ handleActiveChoicesChange }) => type => choice => () =>
      handleActiveChoicesChange(choice, type),
    handleActiveQuestionChange: ({ handleActiveQuestionChange }) => index => () =>
      handleActiveQuestionChange(index),
    handleCompleteQuestion: ({ handleCompleteQuestion }) => index => () =>
      handleCompleteQuestion(index),
    handleSubmit: ({
      activeQuestion,
      questions,
      handleNewResponse,
      handleSubmit,
      inputValue,
    }) => () => {
      // if the question has been answered, add a response
      if (inputValue && (inputValue > 0 || inputValue.length > 0)) {
        const { instanceId, type } = questions[activeQuestion]

        const response = {}
        if ([QuestionTypes.SC, QuestionTypes.MC].includes(type)) {
          response.choices = inputValue
        } else if (type === 'FREE') {
          response.value = inputValue
        }

        handleNewResponse({ instanceId, response })
      }

      handleSubmit()
    },
  }),
)(QuestionArea)
