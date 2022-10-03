import { Attachment } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { without } from 'ramda'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

// eslint-disable-next-line prettier/prettier
import React from 'react'

import { QUESTION_GROUPS, QUESTION_TYPES } from './constants'
import { FREETextAnswerOptions } from './questions/FREETextAnswerOptions'
import { NUMERICALAnswerOptions } from './questions/NUMERICALAnswerOptions'
import { QuestionAttachment } from './questions/QuestionAttachment'
import { SCAnswerOptions } from './questions/SCAnswerOptions'
import SessionProgress from './questions/SessionProgress'

const messages = {
  [QUESTION_TYPES.SC]: <p>Bitte eine einzige Option auswählen:</p>,
  [QUESTION_TYPES.MC]: <p>Bitte eine oder mehrere Optionen auswählen:</p>,
  [QUESTION_TYPES.FREE_TEXT]: <p>Bitte eine Antwort eingeben:</p>,
  [QUESTION_TYPES.NUMERICAL]: <p>Bitte eine Zahl eingeben:</p>,
}

export interface StudentQuestionProps {
  activeIndex: number
  numItems: number
  expiresAt?: Date
  timeLimit?: number
  isSubmitDisabled: boolean
  onSubmit: () => void
  onExpire: () => void
  currentQuestion: {
    content: string
    contentPlain: string
    id: number
    name: string
    type: string
    options: any
    instanceId: number
    attachments?: Attachment[] | undefined
  }
  inputValue: string | any[]
  inputValid: boolean
  inputEmpty: boolean
  setInputState: (input: any) => void
}

export const StudentQuestion = ({
  activeIndex,
  numItems,
  expiresAt,
  timeLimit,
  isSubmitDisabled,
  onSubmit,
  onExpire,
  currentQuestion,
  inputValue,
  inputValid,
  inputEmpty,
  setInputState,
}: StudentQuestionProps) => {
  const onActiveChoicesChange =
    (type: string): any =>
    (choice: any): any =>
    (): void => {
      const validateChoices = (newValue: any): boolean =>
        type === QUESTION_TYPES.SC ? newValue.length === 1 : newValue.length > 0

      if (
        inputValue &&
        (type === QUESTION_TYPES.MC || type === QUESTION_TYPES.KPRIM)
      ) {
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

  return (
    <div>
      <SessionProgress
        activeIndex={activeIndex}
        numItems={numItems}
        expiresAt={expiresAt}
        timeLimit={timeLimit}
        isSubmitDisabled={isSubmitDisabled}
        onSubmit={onSubmit}
        onExpire={onExpire}
      />

      <div className="flex-initial min-h-[6rem] p-3 bg-primary-10 border-uzh-blue-80 border border-solid rounded">
        <Markdown
          content={currentQuestion.content}
          description={currentQuestion.contentPlain}
        />
      </div>

      {currentQuestion.attachments && (
        <div
          className={twMerge(
            'grid grid-cols-1',
            currentQuestion.attachments.length > 1 && 'grid-cols-2'
          )}
        >
          {currentQuestion.attachments.map((attachment: Attachment) => (
            <div
              key={attachment.id}
              className="relative mx-auto h-28 w-36 sm:w-48 sm:h-36 md:w-40 md:h-32 lg:w-56 lg:h-44"
            >
              <QuestionAttachment attachment={attachment} />
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 mt-4">
        <div className="mb-2 font-bold">{messages[currentQuestion.type]}</div>

        {QUESTION_GROUPS.CHOICES.includes(currentQuestion.type) && (
          <SCAnswerOptions
            choices={currentQuestion.options.choices}
            value={typeof inputValue !== 'string' ? inputValue : undefined}
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
            min={currentQuestion.options?.restrictions?.min}
            max={currentQuestion.options?.restrictions?.max}
            valid={inputValid || inputEmpty}
            value={inputValue}
            onChange={onNumericalValueChange}
          />
        )}
      </div>
    </div>
  )
}

export default StudentQuestion
