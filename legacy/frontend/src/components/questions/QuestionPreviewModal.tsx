import React from 'react'

import CustomModal from '../common/CustomModal'
import QuestionArea from '../sessions/join/QuestionArea'

interface Props {
  isOpen: boolean
  // eslint-disable-next-line no-unused-vars
  handleSetIsOpen: (arg: boolean) => void
  question: { id: string; content: string; description: string; createdAt: string; options: any }
  type: string
}

function QuestionPreviewModal({ isOpen, handleSetIsOpen, question, type }: Props): React.ReactElement {
  return (
    <CustomModal escapeEnabled className="!pb-4" open={isOpen} onDiscard={() => handleSetIsOpen(false)}>
      <QuestionArea
        active
        isStaticPreview
        handleNewResponse={null}
        questions={[{ ...question, type }]}
        sessionId={undefined}
        shortname={undefined}
      />
    </CustomModal>
  )
}

export default QuestionPreviewModal
