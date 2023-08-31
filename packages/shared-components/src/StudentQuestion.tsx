import {
  QuestionDisplayMode,
  QuestionType,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { without } from 'ramda'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

// eslint-disable-next-line prettier/prettier
import React from 'react'

import { useTranslations } from 'next-intl'
import { QUESTION_GROUPS } from './constants'
import { FREETextAnswerOptions } from './questions/FREETextAnswerOptions'
import { NUMERICALAnswerOptions } from './questions/NUMERICALAnswerOptions'
import { SCAnswerOptions } from './questions/SCAnswerOptions'
import SessionProgress from './questions/SessionProgress'

export interface StudentQuestionProps {
  activeIndex: number
  numItems: number
  expiresAt?: Date
  timeLimit?: number
  isSubmitDisabled: boolean
  onSubmit: () => void
  onExpire: () => void
  currentQuestion: {
    displayMode?: QuestionDisplayMode
    content: string
    id: number
    name: string
    type: QuestionType
    options: any
    instanceId: number
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
  const t = useTranslations()

  const onActiveChoicesChange =
    (type: string): any =>
    (choice: any): any =>
    (): void => {
      const validateChoices = (newValue: any): boolean =>
        type === QuestionType.Sc ? newValue.length === 1 : newValue.length > 0

      if (
        inputValue &&
        (type === QuestionType.Mc || type === QuestionType.Kprim)
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

    let schema = Yup.object().shape({ input: Yup.string() })

    if (!isNaN(currentQuestion.options?.restrictions?.maxLength)) {
      schema = Yup.object().shape({
        input: Yup.string()
          .max(currentQuestion.options?.restrictions?.maxLength)
          .required(),
      })
    }

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

  const onNumericalValueChange = (inputValue: string): void => {
    const inputEmpty =
      typeof inputValue === 'undefined' ||
      inputValue === null ||
      inputValue === ''

    let validator = Yup.number().required()
    if (
      typeof currentQuestion.options?.restrictions?.min !== 'undefined' &&
      currentQuestion.options?.restrictions?.min !== null &&
      !isNaN(currentQuestion.options?.restrictions?.min)
    ) {
      validator = validator.min(currentQuestion.options?.restrictions?.min)
    }
    if (
      typeof currentQuestion.options?.restrictions?.max !== 'undefined' &&
      currentQuestion.options?.restrictions?.max !== null &&
      !isNaN(currentQuestion.options?.restrictions?.max)
    ) {
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

      <div
        className={twMerge(
          'mt-4 border-slate-300 flex-initial min-h-[6rem] bg-primary-10 border rounded leading-6 prose max-w-none prose-p:!m-0 prose-img:!m-0 p-4'
        )}
      >
        <Markdown content={currentQuestion.content} />
      </div>

      <div className="flex-1 mt-4">
        {typeof currentQuestion.type !== 'undefined' && (
          <div className="mb-2">
            <span className="font-bold">
              {t(`shared.${currentQuestion.type}.text`)}
            </span>{' '}
            {typeof currentQuestion.options?.accuracy !== 'undefined' &&
              !isNaN(currentQuestion.options.accuracy) &&
              t('shared.questions.roundedTo', {
                accuracy: currentQuestion.options.accuracy,
              })}
          </div>
        )}

        {QUESTION_GROUPS.CHOICES.includes(currentQuestion.type) && (
          <SCAnswerOptions
            displayMode={currentQuestion.displayMode}
            choices={currentQuestion.options.choices}
            value={typeof inputValue !== 'string' ? inputValue : undefined}
            onChange={onActiveChoicesChange(currentQuestion.type)}
          />
        )}

        {QUESTION_GROUPS.FREE_TEXT.includes(currentQuestion.type) && (
          <FREETextAnswerOptions
            onChange={onFreeTextValueChange}
            maxLength={currentQuestion.options?.restrictions?.maxLength}
            value={inputValue as string}
          />
        )}

        {QUESTION_GROUPS.NUMERICAL.includes(currentQuestion.type) && (
          <NUMERICALAnswerOptions
            min={currentQuestion.options?.restrictions?.min}
            max={currentQuestion.options?.restrictions?.max}
            valid={inputValid || inputEmpty}
            value={inputValue as string}
            onChange={onNumericalValueChange}
            unit={currentQuestion.options?.unit}
            accuracy={currentQuestion.options?.accuracy}
            hidePrecision={true}
          />
        )}
      </div>
    </div>
  )
}

export default StudentQuestion
