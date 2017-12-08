import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import _without from 'lodash/without'
import Cookies from 'js-cookie'
import { FormattedMessage } from 'react-intl'
import { compose, withStateHandlers, withHandlers, withProps } from 'recompose'

import { QUESTION_TYPES, QUESTION_GROUPS } from '../../../constants'
import { ActionMenu, Collapser } from '../../common'
import { SCAnswerOptions, FREEAnswerOptions } from '../../questionTypes'

const propTypes = {
  active: PropTypes.bool,
  activeQuestion: PropTypes.number,
  handleActiveChoicesChange: PropTypes.func.isRequired,
  handleActiveQuestionChange: PropTypes.func.isRequired,
  handleFreeValueChange: PropTypes.func.isRequired,
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
  const currentQuestion = questions[activeQuestion]

  const messages = {
    [QUESTION_TYPES.SC]: (
      <p>
        <FormattedMessage
          defaultMessage="Please choose a single option below:"
          id="student.questionArea.info.SC"
        />
      </p>
    ),
    [QUESTION_TYPES.MC]: (
      <p>
        <FormattedMessage
          defaultMessage="Please choose one or multiple of the options below:"
          id="student.questionArea.info.MC"
        />
      </p>
    ),
    [QUESTION_TYPES.FREE]: (
      <p>
        <FormattedMessage
          defaultMessage="Please enter your response below:"
          id="student.questionArea.info.FREE"
        />
      </p>
    ),

    [QUESTION_TYPES.FREE_RANGE]: (
      <p>
        <FormattedMessage
          defaultMessage="Please choose a number from the given range below:"
          id="student.questionArea.info.FREE_RANGE"
        />
      </p>
    ),
  }

  return (
    <div className={classNames('questionArea', { active })}>
      <h1 className="header">
        <FormattedMessage defaultMessage="Question" id="student.questionArea.title" />
      </h1>
      {(() => {
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
                if (QUESTION_GROUPS.CHOICES.includes(type)) {
                  return (
                    <SCAnswerOptions
                      disabled={!remainingQuestions.includes(activeQuestion)}
                      options={options[type].choices}
                      value={inputValue}
                      onChange={handleActiveChoicesChange(type)}
                    />
                  )
                }

                if (QUESTION_GROUPS.FREE.includes(type)) {
                  return (
                    <FREEAnswerOptions
                      disabled={!remainingQuestions.includes(activeQuestion)}
                      options={options[type]}
                      questionType={type}
                      value={inputValue}
                      onChange={handleFreeValueChange}
                    />
                  )
                }

                return null
              })()}
            </div>

            <ActionMenu
              activeIndex={questions.length - remainingQuestions.length}
              isSkipModeActive={inputEmpty}
              isSubmitDisabled={remainingQuestions.length === 0 || (!inputEmpty && !inputValid)}
              numItems={questions.length}
              /* items={_range(questions.length).map(index => ({
                done: !remainingQuestions.includes(index),
              }))} */
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

          background-color: white;

          > div {
            display: flex;

            flex-direction: column;

            flex: 1;
          }

          &.active {
            display: flex;
          }

          .header {
            display: none;
          }

          .space {
            margin: 1rem;
          }

          .options,
          .padded {
            padding: 1rem;
          }

          .collapser {
            flex: 0 0 auto;

            background-color: $color-primary-20p;
            border-bottom: 1px solid -color-primary-50p;
            padding: 0.5rem;
          }

          .options {
            margin-top: 1rem;
            flex: 1 1 50%;
          }

          @include desktop-tablet-only {
            display: flex;
            flex-direction: column;

            border: 1px solid $color-primary;
            margin-right: 0.25rem;

            .header {
              display: block;
              margin: 1rem;
            }

            .collapser {
              margin: 0 1rem;
            }

            .options {
              padding: 0;
              margin: 1rem 1rem 0 1rem;
            }
          }
        }
      `}</style>
    </div>
  )
}

QuestionArea.propTypes = propTypes
QuestionArea.defaultProps = defaultProps

export default compose(
  withProps(({ questions }) => {
    const storedResponses = Cookies.getJSON('responses') || Cookies.set('responses', []) || []

    return {
      remainingQuestions: questions
        .map(({ instanceId }, index) => {
          if (storedResponses.includes(instanceId)) {
            return -1
          }

          return index
        })
        .filter(index => index !== -1),
      storedResponses,
    }
  }),
  withStateHandlers(
    ({ remainingQuestions }) => ({
      activeQuestion: 0,
      inputEmpty: true,
      inputValid: false,
      inputValue: undefined,
      isCollapsed: true,
      remainingQuestions,
    }),
    {
      handleActiveChoicesChange: ({ inputValue }) => (choice, type) => {
        const validateChoices = newValue =>
          (type === QUESTION_TYPES.SC ? newValue.length === 1 : newValue.length > 0)

        if (inputValue && type === QUESTION_TYPES.MC) {
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
        inputEmpty: inputValue !== 0 && (!inputValue || inputValue.length === 0),
        inputValid: !!inputValue || inputValue === 0,
        inputValue,
      }),
      handleSubmit: ({ activeQuestion, remainingQuestions }) => () => {
        // calculate the new indices of remaining questions
        const newRemaining = _without(remainingQuestions, activeQuestion)

        return {
          // activate the first question that is still remaining
          activeQuestion: newRemaining[0] || 0,
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
      storedResponses,
    }) => () => {
      const { instanceId, type } = questions[activeQuestion]

      // if the question has been answered, add a response
      if (typeof inputValue !== 'undefined') {
        if (inputValue.length > 0 && QUESTION_GROUPS.CHOICES.includes(type)) {
          handleNewResponse({ instanceId, response: { choices: inputValue } })
        } else if (QUESTION_GROUPS.FREE.includes(type)) {
          handleNewResponse({ instanceId, response: { value: inputValue } })
        }
      }

      // update the stored responses
      Cookies.set('responses', [...storedResponses, instanceId])

      handleSubmit()
    },
  }),
)(QuestionArea)
