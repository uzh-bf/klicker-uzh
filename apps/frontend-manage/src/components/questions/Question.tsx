import { Button } from '@uzh-bf/design-system'
import React, { useState } from 'react'
import { useDrag } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

import { QUESTION_TYPES_SHORT } from '../../constants'

// TODO: readd checkbox
// import CustomCheckbox from '../common/CustomCheckbox'

// TODO: readd modals and tags
// import QuestionDetailsModal from './QuestionDetailsModal'
// import QuestionDuplicationModal from './QuestionDuplicationModal'
// import QuestionPreviewModal from './QuestionPreviewModal'
// import QuestionTags from './QuestionTags'

interface Props {
  checked?: boolean
  id: string
  isArchived?: boolean
  tags?: any[] // TODO: typing
  title: string
  type: string
  contentPlain: string
  onCheck: any // TODO: typing
}

const defaultProps = {
  checked: false,
  isArchived: false,
  lastUsed: [],
  tags: [],
}

function Question({
  checked,
  id,
  tags,
  title,
  type,
  contentPlain,
  onCheck,
  isArchived,
}: Props): React.ReactElement {
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false)
  const [isDuplicationModalOpen, setIsDuplicationModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)

  const [collectedProps, drag] = useDrag({
    item: {
      id,
      type: 'question',
      questionType: type,
      title,
      contentPlain,
    },
    collect: (monitor): any => ({
      isDragging: monitor.isDragging(),
    }),
    type: 'question',
  })

  return (
    <div className="flex w-full mb-4 h-max flex-col-2">
      <div className="min-h-full my-auto mr-2">
        CB
        {/* <CustomCheckbox checked={checked} id={id} onCheck={() => onCheck({ version: activeVersion })}>
            <CheckIcon />
          </CustomCheckbox> */}
      </div>
      <div
        className={twMerge(
          'flex flex-row w-full p-3 bg-grey-20 border border-solid rounded-lg md:flex-col cursor-[grab] hover:shadow-md',
          collectedProps.isDragging && 'opacity-50'
        )}
        ref={drag}
      >
        <div className="flex flex-row flex-1">
          <div className="flex-1">
            {isArchived && <div>ARCHIVED // TODO styling</div>}
            <a
              className="flex-1 text-xl font-bold cursor-pointer text-primary-strong"
              role="button"
              tabIndex={0}
              type="button"
              onClick={() => setIsModificationModalOpen(true)}
              onKeyDown={() => setIsModificationModalOpen(true)}
            >
              {title}
            </a>
            <div className="mb-2 italic">{QUESTION_TYPES_SHORT[type]}</div>
            <div className="flex-1 mb-2">
              {contentPlain.length > 120
                ? `${contentPlain.substring(0, 120)}...`
                : contentPlain}
            </div>
          </div>
          <div className="hidden ml-6 w-max md:block">
            {/* <QuestionTags tags={tags} /> */}
          </div>
        </div>

        <div className="flex flex-col md:w-full w-max md:flex-row">
          <div className="mb-2 md:flex-1 md:mb-0">
            <Button
              className="justify-center h-10 bg-white w-36"
              onClick={(): void => setIsPreviewModalOpen(true)}
            >
              Vorschau
            </Button>
            {/* {isPreviewModalOpen && (
                <QuestionPreviewModal
                  handleSetIsOpen={setIsPreviewModalOpen}
                  isOpen={isPreviewModalOpen}
                  question={versions[activeVersion]}
                  type={type}
                />
              )} */}
          </div>
          <div className="mb-2 md:mr-3 w-36 md:mb-0">
            <Button
              className="justify-center h-10 bg-white w-36"
              onClick={(): void => setIsModificationModalOpen(true)}
            >
              Bearbeiten
            </Button>
            {/* {isModificationModalOpen && (
                <QuestionDetailsModal
                  handleSetIsOpen={setIsModificationModalOpen}
                  isOpen={isModificationModalOpen}
                  questionId={id}
                />
              )} */}
          </div>
          <div className="w-36">
            <Button
              className="justify-center h-10 bg-white w-36"
              onClick={(): void => setIsDuplicationModalOpen(true)}
            >
              Duplizieren
            </Button>
            {/* {isDuplicationModalOpen && (
                <QuestionDuplicationModal
                  handleSetIsOpen={setIsDuplicationModalOpen}
                  isOpen={isDuplicationModalOpen}
                  questionId={id}
                />
              )} */}
          </div>
        </div>
      </div>
    </div>
  )
}

Question.defaultProps = defaultProps

export default Question
