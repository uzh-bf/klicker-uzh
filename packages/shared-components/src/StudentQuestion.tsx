// @ts-nocheck
// ! This file can be ignored in type checks, since a newer version is already available
// ! and will replace the live quiz components as well (StudentElement)

import type {
  ChoicesQuestionData,
  FreeTextQuestionData,
  FreeTextQuestionOptions,
  NumericalQuestionData,
  NumericalQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'
import React, { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import { QUESTION_GROUPS } from './constants'
import { FREETextAnswerOptionsOLD } from './questions/FREETextAnswerOptionsOLD'
import KPAnswerOptionsOLD from './questions/KPAnswerOptionsOLD'
import { NUMERICALAnswerOptionsOLD } from './questions/NUMERICALAnswerOptionsOLD'
import { SCAnswerOptionsOLD } from './questions/SCAnswerOptionsOLD'
import SessionProgress from './questions/SessionProgress'
// TODO: merge validation logic in this file with the validateResponse utils
import {
  validateKprimResponseOld,
  validateMcResponseOld,
} from './utils/validateResponse'

export interface StudentQuestionProps {
  activeIndex: number
  numItems: number
  expiresAt?: Date
  timeLimit?: number
  isSubmitDisabled: boolean
  onSubmit: () => void
  onExpire: () => void
  currentQuestion: (
    | ChoicesQuestionData
    | NumericalQuestionData
    | FreeTextQuestionData
  ) & { instanceId?: number }
  inputValue: string | any[] | {}
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

  useEffect(() => {
    switch (currentQuestion.type) {
      case ElementType.Sc:
      case ElementType.Mc:
        setInputState({
          inputValue: [],
          inputValid: false,
          inputEmpty: true,
        })
        break
      case ElementType.Kprim:
        setInputState({
          inputValue: {},
          inputValid: false,
          inputEmpty: true,
        })
        break
      default:
        setInputState({
          inputValue: '',
          inputValid: false,
          inputEmpty: true,
        })
    }
  }, [currentQuestion.type])

  const onActiveChoicesChange =
    (type: string): any =>
    (choice: any, selectedValue?: boolean): any =>
    (): void => {
      if (inputValue && type === ElementType.Mc) {
        if (typeof inputValue === 'object') {
          setInputState({
            inputEmpty: false,
            inputValid: validateMcResponseOld(inputValue),
            inputValue: [],
          })
        }
        // if the choice is already active, remove it
        if (inputValue.includes(choice)) {
          const newInputValue = inputValue.filter((c) => c !== choice)

          return setInputState({
            inputEmpty: newInputValue.length === 0,
            inputValid: validateMcResponseOld(newInputValue),
            inputValue: newInputValue,
          })
        }

        // else add it to the active choices
        const newInputValue = [...inputValue, choice]
        return setInputState({
          inputEmpty: false,
          inputValid: validateMcResponseOld(newInputValue),
          inputValue: newInputValue,
        })
      }

      if (inputValue && type === ElementType.Kprim) {
        const newInputValue = {
          ...inputValue,
          [choice]: selectedValue,
        }

        return setInputState({
          inputEmpty: Object.keys(newInputValue).length === 0,
          inputValid: validateKprimResponseOld(newInputValue),
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
    const questionOptions = currentQuestion.options as FreeTextQuestionOptions

    let schema = Yup.object().shape({ input: Yup.string() })

    if (
      typeof questionOptions.restrictions?.maxLength === 'number' &&
      !isNaN(questionOptions.restrictions.maxLength)
    ) {
      schema = Yup.object().shape({
        input: Yup.string()
          .max(questionOptions.restrictions.maxLength)
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
    const questionOptions = currentQuestion.options as NumericalQuestionOptions

    let validator = Yup.number().required()
    if (
      typeof questionOptions.restrictions?.min === 'number' &&
      !isNaN(questionOptions.restrictions.min)
    ) {
      validator = validator.min(questionOptions.restrictions.min)
    } else {
      validator = validator.min(-1e30) // prevent underflow
    }
    if (
      typeof questionOptions.restrictions?.max === 'number' &&
      !isNaN(questionOptions.restrictions.max)
    ) {
      validator = validator.max(questionOptions.restrictions.max)
    } else {
      validator = validator.max(1e30) // prevent overflow
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

      {currentQuestion.content !== '<br>' && (
        <div
          className={twMerge(
            'bg-primary-10 prose prose-p:!m-0 prose-img:!m-0 mt-4 min-h-[6rem] max-w-none flex-initial rounded border border-slate-300 p-4 leading-6'
          )}
        >
          <Markdown content={currentQuestion.content} />
        </div>
      )}

      <div className="mt-4 flex-1">
        {typeof currentQuestion.type !== 'undefined' && (
          <div className="mb-2">
            <span className="font-bold">
              {t(`shared.${currentQuestion.type}.text`)}
            </span>{' '}
            {typeof currentQuestion.options?.accuracy === 'number' &&
              !isNaN(currentQuestion.options.accuracy) &&
              t('shared.questions.roundedTo', {
                accuracy: currentQuestion.options.accuracy,
              })}
          </div>
        )}

        {QUESTION_GROUPS.CHOICES.includes(currentQuestion.type) &&
          (currentQuestion.type === ElementType.Kprim ? (
            <KPAnswerOptionsOLD
              displayMode={currentQuestion.options.displayMode}
              type={currentQuestion.type}
              choices={currentQuestion.options.choices}
              value={
                typeof inputValue !== 'string' && !Array.isArray(inputValue)
                  ? inputValue
                  : undefined
              }
              onChange={onActiveChoicesChange(currentQuestion.type)}
            />
          ) : (
            <SCAnswerOptionsOLD
              displayMode={currentQuestion.options.displayMode}
              type={currentQuestion.type}
              choices={currentQuestion.options.choices}
              value={
                typeof inputValue !== 'string' && Array.isArray(inputValue)
                  ? inputValue
                  : undefined
              }
              onChange={onActiveChoicesChange(currentQuestion.type)}
            />
          ))}

        {QUESTION_GROUPS.FREE_TEXT.includes(currentQuestion.type) && (
          <FREETextAnswerOptionsOLD
            onChange={onFreeTextValueChange}
            maxLength={currentQuestion.options?.restrictions?.maxLength}
            value={inputValue as string}
          />
        )}

        {QUESTION_GROUPS.NUMERICAL.includes(currentQuestion.type) && (
          <NUMERICALAnswerOptionsOLD
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
