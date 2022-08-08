import { push } from '@socialgouv/matomo-next'
import dayjs from 'dayjs'
import localForage from 'localforage'
import _get from 'lodash/get'
import _without from 'lodash/without'
import getConfig from 'next/config'
import React, { useEffect, useState } from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { twMerge } from 'tailwind-merge'
import v8n from 'v8n'

import { Icon, Message } from 'semantic-ui-react'
import { QUESTION_GROUPS, QUESTION_TYPES } from '../../../constants'
import { createNotification, requestNotificationPermissions } from '../../../lib/utils/notifications'
import ActionMenu from '../../common/ActionMenu'
import FREEAnswerOptions from '../../questionTypes/FREE/FREEAnswerOptions'
import QuestionDescription from '../../questionTypes/QuestionDescription'
import SCAnswerOptions from '../../questionTypes/SC/SCAnswerOptions'
import QuestionFiles from './QuestionFiles'

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

const intlMessages = defineMessages({
  newQuestionNotification: {
    defaultMessage: 'A new Klicker question is available',
    id: 'joinSession.string.questionNotification',
  },
})

interface Props {
  message?: string
  active: boolean
  expiresAt?: any
  questions: any[]
  handleNewResponse: any
  shortname: string
  sessionId: string
  timeLimit?: number
  isAuthenticationEnabled?: boolean
  isStaticPreview?: boolean
}

const defaultProps = {
  isAuthenticationEnabled: false,
  message: '',
  expiresAt: undefined,
  timeLimit: undefined,
  isStaticPreview: false,
}

function QuestionArea({
  message,
  active,
  questions,
  handleNewResponse,
  shortname,
  sessionId,
  expiresAt,
  timeLimit,
  isAuthenticationEnabled,
  isStaticPreview,
}: Props): React.ReactElement {
  const [remainingQuestions, setRemainingQuestions] = useState([])

  const [activeQuestion, setActiveQuestion] = useState((): any => remainingQuestions[0])
  const [{ inputValue, inputValid, inputEmpty }, setInputState] = useState({
    inputEmpty: true,
    inputValid: false,
    inputValue: undefined,
  })

  const intl = useIntl()

  useEffect(() => {
    requestNotificationPermissions()
  }, [])

  useEffect(() => {
    if (!isStaticPreview) {
      if (!sessionStorage?.getItem(`notification ${questions[0].id}`)) {
        if (questions.length > 0) {
          createNotification(intl.formatMessage(intlMessages.newQuestionNotification), questions[0].description)
        }
        sessionStorage?.setItem(`notification ${questions[0].id}`, 'sent')
      }
    }
  }, [questions.length])

  useEffect((): void => {
    if (!isStaticPreview) {
      const exec = async () => {
        try {
          let storedResponses: any = (await localForage.getItem(`${shortname}-${sessionId}-responses`)) || {
            responses: [],
          }

          if (typeof storedResponses === 'string') {
            storedResponses = JSON.parse(storedResponses)
          }

          const remaining = questions.reduce((indices, { id, execution }, index): any[] => {
            if (storedResponses?.responses?.includes(`${id}-${execution}`)) {
              return indices
            }

            return [...indices, index]
          }, [])

          setActiveQuestion(remaining[0])
          setRemainingQuestions(remaining)
        } catch (e) {
          console.error(e)
        }
      }
      exec()
    } else {
      setActiveQuestion(0)
      setRemainingQuestions([0])
    }
  }, [sessionId, shortname, questions])

  const onActiveChoicesChange =
    (type): any =>
    (choice): any =>
    (): void => {
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

  const onFreeValueChange =
    (type, options): any =>
    (newInputValue): void => {
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
    if (!isStaticPreview) {
      const { id: instanceId, execution, type } = questions[activeQuestion]

      // if the question has been answered, add a response
      if (typeof inputValue !== 'undefined') {
        if (inputValue.length > 0 && QUESTION_GROUPS.CHOICES.includes(type)) {
          handleNewResponse({ instanceId, response: { choices: inputValue } })
        } else if (QUESTION_GROUPS.FREE.includes(type)) {
          handleNewResponse({ instanceId, response: { value: String(inputValue) } })
        }
      } else {
        push(['trackEvent', 'Join Session', 'Question Skipped'])
      }

      // update the stored responses
      if (typeof window !== 'undefined') {
        try {
          const prevResponses: any = await localForage.getItem(`${shortname}-${sessionId}-responses`)
          const stringified = JSON.stringify(
            prevResponses
              ? {
                  responses: [...JSON.parse(prevResponses).responses, `${instanceId}-${execution}`],
                  timestamp: dayjs().unix(),
                }
              : { responses: [`${instanceId}-${execution}`], timestamp: dayjs().unix() }
          )
          await localForage.setItem(`${shortname}-${sessionId}-responses`, stringified)
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
    } else {
      setInputState({
        inputEmpty: true,
        inputValid: false,
        inputValue: undefined,
      })
    }
  }

  const currentQuestion = questions[activeQuestion]

  return (
    <div
      className={twMerge(
        'bg-white flex-1 md:flex',
        !isStaticPreview && 'md:flex-col md:shadow md:rounded-xl p-4',
        isStaticPreview && 'flex-col',
        active ? 'flex' : 'hidden'
      )}
    >
      {!isStaticPreview ? (
        <h1 className="hidden mb-2 md:block md:!text-lg">
          {isAuthenticationEnabled && <Icon color="green" name="lock" />}{' '}
          <FormattedMessage defaultMessage="Question" id="joinSession.questionArea.title" />
        </h1>
      ) : (
        <div className="mb-4 text-xl font-bold">
          <FormattedMessage defaultMessage="Question Preview" id="previewQuestion.title" />
        </div>
      )}

      {((): React.ReactElement => {
        if (remainingQuestions.length === 0) {
          return (
            <div>
              {message && <Message warning>{message}</Message>}
              <FormattedMessage
                defaultMessage="You have already answered all active questions."
                id="joinSession.questionArea.alreadyAnswered"
              />
            </div>
          )
        }

        const { content, description, options, type, files = [] } = currentQuestion

        return (
          <div className="flex flex-col w-full gap-2">
            <div className="">
              <ActionMenu
                activeIndex={questions.length - remainingQuestions.length}
                expiresAt={expiresAt}
                isSkipModeActive={inputEmpty}
                isSubmitDisabled={remainingQuestions.length === 0 || (!inputEmpty && !inputValid)}
                numItems={questions.length}
                timeLimit={timeLimit}
                onSubmit={onSubmit}
              />
            </div>

            <div className="flex-initial min-h-[6rem] p-3 bg-primary-10 border-primary border border-solid rounded">
              <QuestionDescription content={content} description={description} />
            </div>

            {publicRuntimeConfig.s3root && files.length > 0 && (
              <div className="flex-initial">
                <QuestionFiles files={files} />
              </div>
            )}

            <div className="flex-1 mt-4">
              <div className="mb-2 font-bold">{messages[type]}</div>

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
    </div>
  )
}

QuestionArea.defaultProps = defaultProps

export default QuestionArea
