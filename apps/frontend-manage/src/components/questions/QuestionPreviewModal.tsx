import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import { H1, H2 } from '@uzh-bf/design-system'
import React from 'react'

import { Modal } from '@uzh-bf/design-system'
import Markdown from '@klicker-uzh/markdown'

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

  return (
    <Modal
      className="!pb-4"
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
    >
      <H2>{dataQuestion?.question.name}</H2>
      <Markdown content={dataQuestion?.question.content} className="mb-10" />
    </Modal>
  )
}

export default QuestionPreviewModal
