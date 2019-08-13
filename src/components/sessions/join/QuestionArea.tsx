import React, { useState, useEffect } from 'react'
import classNames from 'classnames'
import _without from 'lodash/without'
import _get from 'lodash/get'
import v8n from 'v8n'
import dayjs from 'dayjs'
import getConfig from 'next/config'
import { FormattedMessage } from 'react-intl'
import { convertFromRaw } from 'draft-js'

import QuestionFiles from './QuestionFiles'
import { QUESTION_TYPES, QUESTION_GROUPS } from '../../../constants'
import ActionMenu from '../../common/ActionMenu'
import Collapser from '../../common/Collapser'
import QuestionDescription from '../../questionTypes/QuestionDescription'
import SCAnswerOptions from '../../questionTypes/SC/SCAnswerOptions'
import FREEAnswerOptions from '../../questionTypes/FREE/FREEAnswerOptions'

const { publicRuntimeConfig } = getConfig()

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

interface Props {
  active: boolean
  questions: any[]
  handleNewResponse: Function
  shortname: string
  sessionId: string
}

const defaultProps = {
  questions: [],
}

function QuestionArea({ active, questions, handleNewResponse, shortname, sessionId }: Props): React.ReactElement {
  const [remainingQuestions, setRemainingQuestions] = useState([])

  const [activeQuestion, setActiveQuestion] = useState((): any => remainingQuestions[0])
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [{ inputValue, inputValid, inputEmpty }, setInputState] = useState({
    inputEmpty: true,
    inputValid: false,
    inputValue: undefined,
  })

  useEffect((): void => {
    try {
      if (window.localStorage) {
        const storedResponses = JSON.parse(localStorage.getItem(`${shortname}-${sessionId}-responses`)) || {
          responses: [],
        }

        const remaining = questions.reduce((indices, { id, execution }, index): any[] => {
          if (storedResponses.responses.includes(`${id}-${execution}`)) {
            return indices
          }

          return [...indices, index]
        }, [])

        setActiveQuestion(remaining[0])
        setRemainingQuestions(remaining)
      } else {
        const remaining = questions.map((_, ix): number => ix)
        setActiveQuestion(remaining[0])
        setRemainingQuestions(remaining)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const onActiveChoicesChange = (type): Function => (choice): Function => (): void => {
    const validateChoices = (newValue): boolean =>
      type === QUESTION_TYPES.SC ? newValue.length === 1 : newValue.length > 0

    if (inputValue && type === QUESTION_TYPES.MC) {
      // if the choice is already active, remove it
      if (inputValue.includes(choice)) {
        const newInputValue = _without(inputValue, choice)

        return setInputState({
          inputEmpty: newInputValue.length === 0,
          inputValid: validateChoices(newInputValue),
          inputValue: newInputValue,
        })
      }

      // else add it to the active choices
      const newInputValue = [...inputValue, choice]
      return setInputState({
        inputEmpty: false,
        inputValid: validateChoices(newInputValue),
        inputValue: newInputValue,
      })
    }

    // initialize the value with the first choice
    return setInputState({
      inputEmpty: false,
      inputValid: true,
      inputValue: [choice],
    })
  }

  const onFreeValueChange = (type, options): any => (newInputValue): void => {
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

    return setInputState({
      inputEmpty: newInputValue !== 0 && (!newInputValue || newInputValue.length === 0),
      inputValid: validator.test(newInputValue) || validator.test(+newInputValue),
      inputValue: newInputValue,
    })
  }

  const onSubmit = async (): Promise<void> => {
    const { id: instanceId, execution, type } = questions[activeQuestion]

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
                ? { responses: [...prevResponses.responses, `${instanceId}-${execution}`], timestamp: dayjs().unix() }
                : { responses: [`${instanceId}-${execution}`], timestamp: dayjs().unix() }
            )
          )
        }
      } catch (e) {
        console.error(e)
      }
    }

    // calculate the new indices of remaining questions
    const newRemaining = _without(remainingQuestions, activeQuestion)

    setActiveQuestion(newRemaining[0] || 0)
    setInputState({
      inputEmpty: true,
      inputValid: false,
      inputValue: undefined,
    })
    setRemainingQuestions(newRemaining)
  }

  const currentQuestion = questions[activeQuestion]

  return (
    <div className={classNames('questionArea', { active })}>
      <h1 className="header">
        <FormattedMessage defaultMessage="Question" id="joinSession.questionArea.title" />
      </h1>
      {((): React.ReactElement => {
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
                // setActiveIndex={onActiveQuestionChange}
                onSubmit={onSubmit}
              />
            </div>

            <div className="collapser">
              <Collapser collapsed={isCollapsed} handleCollapseToggle={(): void => setIsCollapsed(!isCollapsed)}>
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

              {((): React.ReactElement => {
                if (QUESTION_GROUPS.CHOICES.includes(type)) {
                  return (
                    <SCAnswerOptions
                      disabled={!remainingQuestions.includes(activeQuestion)}
                      options={options[type].choices}
                      value={inputValue}
                      onChange={onActiveChoicesChange(type)}
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
                      onChange={onFreeValueChange(type, options[type])}
                    />
                  )
                }

                return null
              })()}
            </div>
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
      `}</style>
    </div>
  )
}

QuestionArea.defaultProps = defaultProps

export default QuestionArea
