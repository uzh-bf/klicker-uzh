import React from 'react'
import { Modal, Button } from 'semantic-ui-react'

import SCCreationOptions from '../questionTypes/SC/SCCreationOptions'
import SCCreationPreview from '../questionTypes/SC/SCCreationPreview'
import FREECreationOptions from '../questionTypes/FREE/FREECreationOptions'
import FREECreationPreview from '../questionTypes/FREE/FREECreationPreview'
import { QUESTION_TYPES } from '../../constants'
import { convertToSlate } from '../../lib/utils/slateMdConversion'

interface Props {
  isOpen: boolean
  // eslint-disable-next-line no-unused-vars
  handleSetIsOpen: (boolean) => void
  question: any
  type: string
}

function QuestionPreviewModal({ isOpen, handleSetIsOpen, question, type }: Props): React.ReactElement {
  const typeComponents = {
    [QUESTION_TYPES.SC]: {
      input: SCCreationOptions,
      preview: SCCreationPreview,
    },
    [QUESTION_TYPES.MC]: {
      input: SCCreationOptions,
      preview: SCCreationPreview,
    },
    [QUESTION_TYPES.FREE]: {
      input: FREECreationOptions,
      preview: FREECreationPreview,
    },
    [QUESTION_TYPES.FREE_RANGE]: {
      input: FREECreationOptions,
      preview: FREECreationPreview,
    },
  }
  const Preview = typeComponents[type].preview
  const content = convertToSlate(question.content)

  return (
    <Modal closeOnDimmerClick={false} open={isOpen} size="large" onClose={(): void => handleSetIsOpen(false)}>
      <Modal.Content>
        <Preview description={content} options={question.options[type]} questionType={type} />
        <Button onClick={() => handleSetIsOpen(false)}>Close</Button>
      </Modal.Content>
    </Modal>
  )
}

export default QuestionPreviewModal
