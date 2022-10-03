import { Attachment } from '@klicker-uzh/graphql/dist/ops'
import { push } from '@socialgouv/matomo-next'
import { H2 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import { without } from 'ramda'
import React, { useEffect, useState } from 'react'
import * as Yup from 'yup'

import { StudentQuestion } from 'shared-components'
import { QUESTION_GROUPS, QUESTION_TYPES } from '../../constants'

// TODO: notifications

interface QuestionAreaProps {
  expiresAt?: Date
  questions: {
    content: string
    contentPlain: string
    id: string
    name: string
    type: string
    options: any
    instanceId: number
    attachments?: Attachment[]
  }[]
  handleNewResponse: (type: string, instanceId: number, answer: any) => void
  sessionId: string
  execution: number
  timeLimit?: number
  isStaticPreview?: boolean
}

function QuestionArea({
  expiresAt,
  questions,
  handleNewResponse,
  sessionId,
  timeLimit,
  execution,
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
      : '',
  })

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

        const remaining = questions
          .map((question: any) => question.instanceId)
          .reduce((indices, instanceId, index): any[] => {
            if (
              storedResponses?.responses?.includes(`${instanceId}-${execution}`)
            ) {
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
  }, [sessionId, questions, execution])

  const onActiveChoicesChange =
    (type: string): any =>
    (choice: any): any =>
    (): void => {
      const validateChoices = (newValue: any): boolean =>
        type === QUESTION_TYPES.SC ? newValue.length === 1 : newValue.length > 0

      if (inputValue && (type === QUESTION_TYPES.MC || type === QUESTION_TYPES.KPRIM)) {
        // if the choice is already active, remove it
        if (inputValue.includes(choice)) {
          const newInputValue = without([choice], inputValue)

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
    const inputEmpty = !inputValue || inputValue.length === 0

    const schema = Yup.object().shape({
      input: Yup.string()
        .max(currentQuestion.options?.restrictions?.maxLength)
        .required(),
    })

    try {
      const isValid = schema.validateSync({ input: inputValue })
      if (isValid) {
        return setInputState({
          inputEmpty: inputEmpty,
          inputValid: true,
          inputValue: inputValue,
        })
      }
    } catch (error: any) {
      return setInputState({
        inputEmpty: inputEmpty,
        inputValid: false,
        inputValue: inputValue,
      })
    }
  }

  const onNumericalValueChange = (inputValue: any): void => {
    const inputEmpty =
      inputValue !== 0 && (!inputValue || inputValue.length === 0)

    let validator = Yup.number().required()
    if (currentQuestion.options?.restrictions?.min) {
      validator = validator.min(currentQuestion.options?.restrictions?.min)
    }
    if (currentQuestion.options?.restrictions?.max) {
      validator = validator.max(currentQuestion.options?.restrictions?.max)
    }
    const schema = Yup.object().shape({
      input: validator,
    })

    try {
      const isValid = schema.validateSync({ input: inputValue })
      if (isValid) {
        return setInputState({
          inputEmpty: inputEmpty,
          inputValid: true,
          inputValue: inputValue,
        })
      }
    } catch (error: any) {
      return setInputState({
        inputEmpty: inputEmpty,
        inputValid: false,
        inputValue: inputValue,
      })
    }
  }

  const onSubmit = async (): Promise<void> => {
    const { instanceId, type } = questions[activeQuestion]

    // if the question has been answered, add a response
    if (typeof inputValue !== 'undefined') {
      answerQuestion(inputValue, type, instanceId)
    } else {
      push(['trackEvent', 'Live Session', 'Question Skipped'])
    }

    // update the stored responses
    await updateStoredResponses(instanceId, sessionId, execution)

    // calculate the new indices of remaining questions
    const newRemaining = without([activeQuestion], remainingQuestions)

    setActiveQuestion(newRemaining[0] || 0)
    setInputState({
      inputEmpty: true,
      inputValid: false,
      inputValue: '',
    })
    setRemainingQuestions(newRemaining)
  }

  const onExpire = async (): Promise<void> => {
    const { instanceId, type } = questions[activeQuestion]

    // save the response, if one was given before the time expired
    if (typeof inputValue !== 'undefined') {
      answerQuestion(inputValue, type, instanceId)
    }

    const remainingQuestionIds = remainingQuestions.map(
      (index: number) => questions[index].instanceId
    )
    await updateStoredResponses(remainingQuestionIds, sessionId, execution)

    // automatically skip all possibly remaining questions
    setInputState({
      inputEmpty: true,
      inputValid: false,
      inputValue: undefined,
    })
    setRemainingQuestions([])
    push(['trackEvent', 'Live Session', 'Time expired'])
  }

  // use the handleNewResponse function to add a response to the question instance
  const answerQuestion = (
    value: any,
    type: string,
    instanceId: number
  ): void => {
    if (value.length > 0 && QUESTION_GROUPS.CHOICES.includes(type)) {
      handleNewResponse(type, instanceId, value)
    } else if (QUESTION_GROUPS.FREE.includes(type)) {
      handleNewResponse(type, instanceId, value)
    }
  }

  const updateStoredResponses = async (
    instanceId: number | number[],
    sessionId: string,
    execution: number
  ) => {
    if (typeof window !== 'undefined') {
      try {
        const prevResponses: any = await localForage.getItem(
          `${sessionId}-responses`
        )
        let newResponses: string[] = []

        if (Array.isArray(instanceId)) {
          newResponses = instanceId.map(
            (instanceId: number) => `${instanceId}-${execution}`
          )
        } else {
          newResponses = [`${instanceId}-${execution}`]
        }
        const stringified = JSON.stringify(
          prevResponses
            ? {
                responses: [
                  ...JSON.parse(prevResponses).responses,
                  ...newResponses,
                ],
                timestamp: dayjs().unix(),
              }
            : {
                responses: newResponses,
                timestamp: dayjs().unix(),
              }
        )
        await localForage.setItem(`${sessionId}-responses`, stringified)
      } catch (e) {
        console.error(e)
        // TODO: maybe delete possible responses that were already saved in case of failure
      }
    }
  }

  return (
    <div className="w-full h-full min-h-content">
      <H2 className="hidden mb-2 md:block">Frage</H2>

      {remainingQuestions.length === 0 ? (
        'Sie haben bereits alle aktiven Fragen beantwortet.'
      ) : (
        <div className="flex flex-col w-full gap-2">
          <StudentQuestion
            activeIndex={questions.length - remainingQuestions.length}
            numItems={questions.length}
            expiresAt={expiresAt}
            timeLimit={timeLimit}
            isSubmitDisabled={
              remainingQuestions.length === 0 ||
              (!inputEmpty && !inputValid) ||
              inputEmpty
            }
            onSubmit={onSubmit}
            onExpire={onExpire}
            currentQuestion={currentQuestion}
            inputValue={inputValue}
            inputValid={inputValid}
            inputEmpty={inputEmpty}
            onActiveChoicesChange={onActiveChoicesChange}
            onFreeTextValueChange={onFreeTextValueChange}
            onNumericalValueChange={onNumericalValueChange}
          />
        </div>
      )}
    </div>
  )
}

export default QuestionArea
