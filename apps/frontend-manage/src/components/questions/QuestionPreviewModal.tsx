import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import React, { useState } from 'react'

import { Modal } from '@uzh-bf/design-system'
import { QUESTION_GROUPS, StudentQuestion } from 'shared-components'

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
    inputValue: QUESTION_GROUPS.CHOICES.includes(
      dataQuestion?.question?.type || ''
    )
      ? new Array(
          dataQuestion?.question?.questionData.options.choices.length,
          false
        )
      : '',
  })

  return (
    <Modal
      className="!pb-4"
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
    >
      <H2>{dataQuestion?.question?.name}</H2>
      <StudentQuestion
        activeIndex={0}
        numItems={1}
        isSubmitDisabled={(!inputEmpty && !inputValid) || inputEmpty}
        onSubmit={() =>
          setInputState({
            inputEmpty: true,
            inputValid: false,
            inputValue: QUESTION_GROUPS.CHOICES.includes(
              dataQuestion?.question?.type || ''
            )
              ? new Array(
                  dataQuestion?.question?.questionData.options.choices.length,
                  false
                )
              : '',
          })
        }
        onExpire={() => null}
        currentQuestion={{
          instanceId: 0,
          ...dataQuestion?.question,
          options: dataQuestion?.question?.questionData.options,
        }}
        inputValue={inputValue}
        inputValid={inputValid}
        inputEmpty={inputEmpty}
        setInputState={setInputState}
      />
    </Modal>
  )
}

export default QuestionPreviewModal
