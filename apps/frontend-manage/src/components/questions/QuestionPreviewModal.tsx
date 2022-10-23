import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import React, { useState } from 'react'

import Markdown from '@klicker-uzh/markdown'
import { Modal } from '@uzh-bf/design-system'
import { QUESTION_GROUPS } from 'shared-components/src/constants'
import StudentQuestion from 'shared-components/src/StudentQuestion'

interface QuestionPreviewModalProps {
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  questionId: number
}

function QuestionPreviewModal({
  isOpen,
  handleSetIsOpen,
  questionId,
}: QuestionPreviewModalProps): React.ReactElement {
  const {
    loading: loadingQuestion,
    error: errorQuestion,
    data: dataQuestion,
  } = useQuery(GetSingleQuestionDocument, {
    variables: { id: questionId },
  })

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
      title={dataQuestion?.question?.name}
    >
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
      {/* // TODO: remove this temporary fix to show parsed feedbacks once a unified component for all session types has been created and can be used here */}
      {dataQuestion?.question?.hasAnswerFeedbacks && (
        <div className="mt-6 leading-4 prose border-t-4 border-gray-400 border-solid max-w-none">
          {dataQuestion?.question?.questionData.options.choices.map(
            (choice: any, index: number) => {
              console.log(choice)
              return (
                <div key={index}>
                  <H3 className="mt-4">Feedback for Choice {index + 1}</H3>
                  <Markdown className="mt-2" content={choice.feedback} />
                </div>
              )
            }
          )}
        </div>
      )}
    </Modal>
  )
}

export default QuestionPreviewModal
