import { push } from '@socialgouv/matomo-next'
import { H1 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import _without from 'lodash/without'
import React, { useEffect, useState } from 'react'
import v8n from 'v8n'

import { QUESTION_GROUPS, QUESTION_TYPES } from '../../constants'
import FREETextAnswerOptions from '../questions/FREETextAnswerOptions'
import NUMERICALAnswerOptions from '../questions/NUMERICALAnswerOptions'
import QuestionDescription from '../questions/QuestionDescription'
import SCAnswerOptions from '../questions/SCAnswerOptions'
import SessionProgress from './SessionProgress'

// TODO: notifications

interface QuestionAreaProps {
  expiresAt?: Date
  questions: any[] // { content: string, contentPlain: string, id: string, name: string, type: string, options: any }[]
  handleNewResponse: any // TODO: correct typing
  sessionId: string
  timeLimit?: number
  isStaticPreview?: boolean
}

const messages = {
  [QUESTION_TYPES.SC]: <p>Bitte eine einzige Option auswählen:</p>,
  [QUESTION_TYPES.MC]: <p>Bitte eine oder mehrere Optionen auswählen:</p>,
  [QUESTION_TYPES.FREE_TEXT]: <p>Bitte eine Antwort eingeben:</p>,
  [QUESTION_TYPES.NUMERICAL]: (
    <p>Bitte eine Antwort aus dem vorgegebenen Bereich auswählen:</p>
  ),
}

function QuestionArea({
  expiresAt,
  questions,
  handleNewResponse,
  sessionId,
  timeLimit,
}: QuestionAreaProps): React.ReactElement {
  const [remainingQuestions, setRemainingQuestions] = useState(new Array())
  const [activeQuestion, setActiveQuestion] = useState(
    (): any => remainingQuestions[0]
  )
  const currentQuestion = questions[activeQuestion]

  const [{ inputValue, inputValid, inputEmpty }, setInputState] = useState({
    inputEmpty: true,
    inputValid: false,
    inputValue: QUESTION_GROUPS.CHOICES.includes(
      questions[remainingQuestions[0]]?.type
    )
      ? new Array(questions[remainingQuestions[0]]?.options.length, false)
      : undefined,
  })

  // TODO: fix response storage, currently multiple replays are possible - maybe automatically resolved with handleNewResponse implementation
  useEffect((): void => {
    const exec = async () => {
      try {
        let storedResponses: any = (await localForage.getItem(
          `${sessionId}-responses`
        )) || {
          responses: [],
        }

        if (typeof storedResponses === 'string') {
          storedResponses = JSON.parse(storedResponses)
        }

        const remaining = questions.reduce((indices, { id }, index): any[] => {
          if (storedResponses?.responses?.includes(id)) {
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
  }, [sessionId, questions])

  const onActiveChoicesChange =
    (type: string): any =>
    (choice: any): any =>
    (): void => {
      const validateChoices = (newValue: any): boolean =>
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

  const onFreeTextValueChange = (inputValue: any): void => {
    let validator = v8n()
    validator = validator.string()

    return setInputState({
      inputEmpty: !inputValue || inputValue.length === 0,
      inputValid: validator.test(inputValue) || validator.test(+inputValue),
      inputValue: inputValue,
    })
  }

  const onNumericalValueChange = (inputValue: any): void => {
    let validator = v8n()
    validator = validator.number(false)

    if (currentQuestion.options?.restrictions?.max) {
      validator = validator.lessThanOrEqual(
        currentQuestion.options?.restrictions?.max
      )
    }

    if (currentQuestion.options?.restrictions?.min) {
      validator = validator.greaterThanOrEqual(
        currentQuestion.options?.restrictions?.min
      )
    }

    // ! issue: component returns empty string if the entered thing is not a number
    console.log(inputValue)

    return setInputState({
      inputEmpty: inputValue !== 0 && (!inputValue || inputValue.length === 0),
      inputValid: validator.test(inputValue) || validator.test(+inputValue),
      inputValue: inputValue,
    })
  }

  // const onFreeValueChange =
  //   (type: string, options: any): any =>
  //   (newInputValue: any): void => {
  //     let validator = v8n()

  //     if (type === QUESTION_TYPES.NUMERICAL) {
  //       validator = validator.number(false)

  //       if (_get(options, 'restrictions.max')) {
  //         validator = validator.lessThanOrEqual(options.restrictions.max)
  //       }

  //       if (_get(options, 'restrictions.min')) {
  //         validator = validator.greaterThanOrEqual(options.restrictions.min)
  //       }
  //     } else {
  //       validator = validator.string()
  //     }

  //     return setInputState({
  //       inputEmpty:
  //         newInputValue !== 0 && (!newInputValue || newInputValue.length === 0),
  //       inputValid:
  //         validator.test(newInputValue) || validator.test(+newInputValue),
  //       inputValue: newInputValue,
  //     })
  //   }

  const onSubmit = async (): Promise<void> => {
    const { id: instanceId, execution, type } = questions[activeQuestion]

    // if the question has been answered, add a response
    if (typeof inputValue !== 'undefined') {
      if (inputValue.length > 0 && QUESTION_GROUPS.CHOICES.includes(type)) {
        handleNewResponse({ instanceId, response: { choices: inputValue } })
      } else if (QUESTION_GROUPS.FREE.includes(type)) {
        handleNewResponse({
          instanceId,
          response: { value: String(inputValue) },
        })
      }
    } else {
      push(['trackEvent', 'Join Session', 'Question Skipped'])
    }

    // update the stored responses
    if (typeof window !== 'undefined') {
      try {
        const prevResponses: any = await localForage.getItem(
          `${sessionId}-responses`
        )
        const stringified = JSON.stringify(
          prevResponses
            ? {
                responses: [
                  ...JSON.parse(prevResponses).responses,
                  `${instanceId}-${execution}`,
                ],
                timestamp: dayjs().unix(),
              }
            : {
                responses: [`${instanceId}-${execution}`],
                timestamp: dayjs().unix(),
              }
        )
        await localForage.setItem(`${sessionId}-responses`, stringified)
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

  return (
    <div className="w-full h-full">
      <H1 className="hidden mb-2 md:block md:!text-lg">Frage</H1>

      {remainingQuestions.length === 0 ? (
        'Sie haben bereits alle aktiven Fragen beantwortet.'
      ) : (
        <div className="flex flex-col w-full gap-2">
          <SessionProgress
            activeIndex={questions.length - remainingQuestions.length}
            numItems={questions.length}
            expiresAt={expiresAt}
            timeLimit={timeLimit}
            isSkipModeActive={inputEmpty}
            isSubmitDisabled={
              remainingQuestions.length === 0 || (!inputEmpty && !inputValid)
            }
            onSubmit={onSubmit}
            onExpire={onSubmit}
          />

          <div className="flex-initial min-h-[6rem] p-3 bg-primary-10 border-uzh-blue-80 border border-solid rounded">
            <QuestionDescription
              content={currentQuestion.content}
              description={currentQuestion.description}
            />
          </div>

          {/* // TODO */}
          <div>QUESTIONFILES</div>

          <div className="flex-1 mt-4">
            <div className="mb-2 font-bold">
              {messages[currentQuestion.type]}
            </div>

            {QUESTION_GROUPS.CHOICES.includes(currentQuestion.type) && (
              <SCAnswerOptions
                choices={currentQuestion.options.choices}
                value={inputValue}
                onChange={onActiveChoicesChange(currentQuestion.type)}
              />
            )}

            {QUESTION_GROUPS.FREE_TEXT.includes(currentQuestion.type) && (
              <FREETextAnswerOptions
                onChange={onFreeTextValueChange}
                maxLength={currentQuestion.options?.restrictions?.maxLength}
              />
            )}

            {QUESTION_GROUPS.NUMERICAL.includes(currentQuestion.type) && (
              <NUMERICALAnswerOptions
                valid={inputValid || inputEmpty}
                value={inputValue}
                onChange={onNumericalValueChange}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionArea
