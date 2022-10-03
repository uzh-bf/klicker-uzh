import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { without } from 'ramda'
import React, { useState } from 'react'
import * as Yup from 'yup'

import { Modal } from '@uzh-bf/design-system'
import { StudentQuestion } from 'shared-components'
import { QUESTION_GROUPS, QUESTION_TYPES } from '../../constants'

interface Props {
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  questionId: number
}

function QuestionPreviewModal({
  isOpen,
  handleSetIsOpen,
  questionId,
}: Props): React.ReactElement {
  // TODO: create query to fetch single question with details
  const {
    loading: loadingQuestion,
    error: errorQuestion,
    data: dataQuestion,
  } = useQuery(GetSingleQuestionDocument, {
    variables: { id: questionId },
  })

  console.log(dataQuestion)

  const [{ inputValue, inputValid, inputEmpty }, setInputState] = useState({
    inputEmpty: true,
    inputValid: false,
    inputValue: QUESTION_GROUPS.CHOICES.includes(dataQuestion?.question.type)
      ? new Array(dataQuestion?.question.questionData.options.length, false)
      : '',
  })

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
        .max(
          dataQuestion?.question.questionData.options?.restrictions?.maxLength
        )
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
    if (dataQuestion?.question.questionData.options?.restrictions?.min) {
      validator = validator.min(
        dataQuestion?.question.questionData.options?.restrictions?.min
      )
    }
    if (dataQuestion?.question.questionData.options?.restrictions?.max) {
      validator = validator.max(
        dataQuestion?.question.questionData.options?.restrictions?.max
      )
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
    <Modal
      className="!pb-4"
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
    >
      <H2>{dataQuestion?.question.name}</H2>
      <StudentQuestion
        activeIndex={0}
        numItems={1}
        isSubmitDisabled={(!inputEmpty && !inputValid) || inputEmpty}
        onSubmit={() =>
          setInputState({
            inputEmpty: true,
            inputValid: false,
            inputValue: QUESTION_GROUPS.CHOICES.includes(
              dataQuestion?.question.type
            )
              ? new Array(
                  dataQuestion?.question.questionData.options.length,
                  false
                )
              : '',
          })
        }
        onExpire={() => null}
        currentQuestion={{
          ...dataQuestion?.question,
          options: dataQuestion?.question.questionData.options,
        }}
        inputValue={inputValue}
        inputValid={inputValid}
        inputEmpty={inputEmpty}
        onActiveChoicesChange={onActiveChoicesChange}
        onFreeTextValueChange={onFreeTextValueChange}
        onNumericalValueChange={onNumericalValueChange}
      />
    </Modal>
  )
}

export default QuestionPreviewModal
