import React from 'react'
import { Button } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import SCCreationOptions from '../questionTypes/SC/SCCreationOptions'
import SCCreationPreview from '../questionTypes/SC/SCCreationPreview'
import FREECreationOptions from '../questionTypes/FREE/FREECreationOptions'
import FREECreationPreview from '../questionTypes/FREE/FREECreationPreview'
import CustomModal from '../common/CustomModal'
import { QUESTION_TYPES } from '../../constants'
import { convertToSlate } from '../../lib/utils/slateMdConversion'

interface Props {
  isOpen: boolean
  // eslint-disable-next-line no-unused-vars
  handleSetIsOpen: (arg: boolean) => void
  question: { id: string; content: string; description: string; createdAt: string; options: any }
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
    <CustomModal className="!pb-4" open={isOpen}>
      <div className="mb-4 text-xl font-bold">
        <FormattedMessage defaultMessage="Question Preview" id="previewQuestion.title" />
      </div>
      <Preview description={content} options={question.options[type]} questionType={type} />
      <Button className="!mt-4" onClick={() => handleSetIsOpen(false)}>
        Close
      </Button>
    </CustomModal>
  )
}

export default QuestionPreviewModal
