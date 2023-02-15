import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { H3, Modal } from '@uzh-bf/design-system'
import Image from 'next/image'
import React, { useState } from 'react'
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
      className={{ title: 'pb-4' }}
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
        <div className="mt-6 leading-6 prose border-t-4 border-gray-400 border-solid max-w-none">
          {dataQuestion?.question?.questionData.options.choices.map(
            (choice: any, index: number) => {
              return (
                <div key={index}>
                  <H3 className={{ root: 'mt-4' }}>
                    Feedback for Choice {index + 1}
                  </H3>
                  <Markdown
                    components={{
                      img: ({ src, alt }: any) => (
                        <Image src={src} alt="Image" width={200} height={200} />
                      ),
                    }}
                    className="mt-2 prose max-w-none prose-p:m-0 prose-img:m-0"
                    content={choice.feedback}
                  />
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
