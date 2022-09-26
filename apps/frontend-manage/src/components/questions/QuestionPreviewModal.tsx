import React from 'react'
import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'

import { Modal } from '@uzh-bf/design-system'

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

  const question = {}
  return (
    <Modal
      className="!pb-4"
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
    >
      Question Preview Modal
    </Modal>
  )
}

export default QuestionPreviewModal
