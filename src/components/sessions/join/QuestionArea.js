import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import _without from 'lodash/without'
import _get from 'lodash/get'
import v8n from 'v8n'
import dayjs from 'dayjs'
import getConfig from 'next/config'

import { FormattedMessage } from 'react-intl'
import { convertFromRaw } from 'draft-js'
import { compose, withStateHandlers, withHandlers, withProps } from 'recompose'

import QuestionFiles from './QuestionFiles'
import { QUESTION_TYPES, QUESTION_GROUPS } from '../../../constants'
import { ActionMenu, Collapser } from '../../common'
import { QuestionDescription, SCAnswerOptions, FREEAnswerOptions } from '../../questionTypes'

const { publicRuntimeConfig } = getConfig()

const propTypes = {
  active: PropTypes.bool.isRequired,
  activeQuestion: PropTypes.number,
  handleActiveChoicesChange: PropTypes.func.isRequired,
  handleActiveQuestionChange: PropTypes.func.isRequired,
  handleFreeValueChange: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  inputEmpty: PropTypes.bool.isRequired,
  inputValid: PropTypes.bool.isRequired,
  inputValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]).isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  questions: PropTypes.array,
  remainingQuestions: PropTypes.array,
  toggleIsCollapsed: PropTypes.func.isRequired,
}

const defaultProps = {
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
        <FormattedMessage defaultMessage="Please choose a single option below:" id="joinSession.questionArea.info.SC" />
      </p>
    ),
    [QUESTION_TYPES.MC]: (
      <p>
        <FormattedMessage
          defaultMessage="Please choose one or multiple of the options below:"
          id="joinSession.questionArea.info.MC"
        />
      </p>
    ),
    [QUESTION_TYPES.FREE]: (
      <p>
        <FormattedMessage defaultMessage="Please enter your response below:" id="joinSession.questionArea.info.FREE" />
      </p>
    ),

    [QUESTION_TYPES.FREE_RANGE]: (
      <p>
        <FormattedMessage
          defaultMessage="Please choose a number from the given range below:"
          id="joinSession.questionArea.info.FREE_RANGE"
        />
      </p>
    ),
  }

  return (
    <div className={classNames('questionArea', { active })}>
      <h1 className="header">
        <FormattedMessage defaultMessage="Question" id="joinSession.questionArea.title" />
      </h1>
      {(() => {
        if (remainingQuestions.length === 0) {
          return (
            <div className="padded">
              <FormattedMessage
                defaultMessage="You have already answered all active questions."
                id="joinSession.questionArea.alreadyAnswered"
              />
            </div>
          )
        }

        const { content, description, options, type, files = [] } = currentQuestion

        // if the content is set, parse it and convert into a content state
        const contentState = content ? convertFromRaw(JSON.parse(content)) : null

        return (
          <div>
            <div className="actions">
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

            <div className="collapser">
              <Collapser collapsed={isCollapsed} handleCollapseToggle={toggleIsCollapsed}>
                <QuestionDescription content={contentState} description={description} />
              </Collapser>
            </div>

            {publicRuntimeConfig.s3root && files.length > 0 && (
              <div className="files">
                <QuestionFiles files={files} />
              </div>
            )}

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
                      onChange={handleFreeValueChange(type, options[type])}
                    />
                  )
                }

                return null
              })()}
            </div>
          </div>
        )
      })()}

      <style jsx>
        {`
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

            .files,
            .collapser {
              flex: 0 0 auto;
              background-color: $color-primary-20p;
              padding: 0.5rem;
              border-bottom: 1px solid $color-primary;
            }

            .collapser {
              border-top: 1px solid $color-primary;
            }

            .files {
            }

            .options {
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

              .collapser,
              .files {
                margin: 0 1rem;
                border: 1px solid $color-primary;
              }

              .files {
                border-top: 0;
              }

              .options {
                padding: 0;
                margin: 1rem 1rem 0 1rem;
              }
            }
          }
        `}
      </style>
    </div>
  )
}

QuestionArea.propTypes = propTypes
QuestionArea.defaultProps = defaultProps

export default compose(
  withProps(({ questions, shortname, sessionId }) => {
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage) {
          const storedResponses = JSON.parse(localStorage.getItem(`${shortname}-${sessionId}-responses`)) || {
            responses: [],
          }

          return {
            remainingQuestions: questions.reduce((indices, { id }, index) => {
              if (storedResponses.responses.includes(id)) {
                return indices
              }

              return [...indices, index]
            }, []),
          }
        }
      } catch (e) {
        console.error(e)
      }
    }

    return {
      remainingQuestions: questions.map((val, ix) => ix),
    }
  }),
  withStateHandlers(
    ({ remainingQuestions }) => ({
      activeQuestion: remainingQuestions[0],
      inputEmpty: true,
      inputValid: false,
      inputValue: undefined,
      isCollapsed: true,
      remainingQuestions,
    }),
    {
      handleActiveChoicesChange: ({ inputValue }) => (choice, type) => {
        const validateChoices = newValue => (type === QUESTION_TYPES.SC ? newValue.length === 1 : newValue.length > 0)

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
      handleFreeValueChange: () => (inputValue, options, type) => {
        let validator = v8n()

        if (type === QUESTION_TYPES.FREE_RANGE) {
          validator = validator.number(false)

          if (_get(options, 'restrictions.max')) {
            validator = validator.lessThanOrEqual(options.restrictions.max)
          }

          if (_get(options, 'restrictions.min')) {
            validator = validator.greaterThanOrEqual(options.restrictions.min)
          }
        } else {
          validator = validator.string()
        }

        return {
          inputEmpty: inputValue !== 0 && (!inputValue || inputValue.length === 0),
          inputValid: validator.test(inputValue) || validator.test(+inputValue),
          inputValue,
        }
      },
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
      toggleIsCollapsed: ({ isCollapsed }) => () => ({
        isCollapsed: !isCollapsed,
      }),
    }
  ),
  withHandlers({
    handleActiveChoicesChange: ({ handleActiveChoicesChange }) => type => choice => () =>
      handleActiveChoicesChange(choice, type),
    handleActiveQuestionChange: ({ handleActiveQuestionChange }) => index => () => handleActiveQuestionChange(index),
    handleCompleteQuestion: ({ handleCompleteQuestion }) => index => () => handleCompleteQuestion(index),
    handleFreeValueChange: ({ handleFreeValueChange }) => (type, options) => inputValue =>
      handleFreeValueChange(inputValue, options, type),
    handleSubmit: ({
      shortname,
      sessionId,
      activeQuestion,
      questions,
      handleNewResponse,
      handleSubmit,
      inputValue,
    }) => async () => {
      const { id: instanceId, type } = questions[activeQuestion]

      // if the question has been answered, add a response
      if (typeof inputValue !== 'undefined') {
        if (inputValue.length > 0 && QUESTION_GROUPS.CHOICES.includes(type)) {
          handleNewResponse({ instanceId, response: { choices: inputValue } })
        } else if (QUESTION_GROUPS.FREE.includes(type)) {
          handleNewResponse({ instanceId, response: { value: String(inputValue) } })
        }
      }

      // update the stored responses
      if (typeof window !== 'undefined') {
        try {
          if (window.localStorage) {
            const prevResponses = JSON.parse(localStorage.getItem(`${shortname}-${sessionId}-responses`))
            localStorage.setItem(
              `${shortname}-${sessionId}-responses`,
              JSON.stringify(
                prevResponses
                  ? { responses: [...prevResponses.responses, instanceId], timestamp: dayjs().unix() }
                  : { responses: [instanceId], timestamp: dayjs().unix() }
              )
            )
          }
        } catch (e) {
          console.error(e)
        }
      }

      handleSubmit()
    },
  })
)(QuestionArea)
