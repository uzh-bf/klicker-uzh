import { Button, Checkbox } from '@uzh-bf/design-system'
import React, { useState } from 'react'
import { useDrag } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

import { QUESTION_TYPES_SHORT } from 'shared-components/src/constants'

// TODO: readd modals and tags
// import QuestionDetailsModal from './QuestionDetailsModal'
// import QuestionDuplicationModal from './QuestionDuplicationModal'
import { useMutation } from '@apollo/client'
import {
  DeleteQuestionDocument,
  GetUserQuestionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import QuestionEditModal from './QuestionEditModal'
import QuestionPreviewModal from './QuestionPreviewModal'
// import QuestionTags from './QuestionTags'

interface Props {
  checked: boolean
  id: number
  isArchived?: boolean
  tags?: any[] // TODO: typing
  title: string
  type: string
  content: string
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
  content,
  onCheck,
  isArchived,
}: Props): React.ReactElement {
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false)
  const [isDuplicationModalOpen, setIsDuplicationModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [deleteQuestion] = useMutation(DeleteQuestionDocument)

  const [collectedProps, drag] = useDrag({
    item: {
      id,
      type: 'question',
      questionType: type,
      title,
      content,
    },
    collect: (monitor): any => ({
      isDragging: monitor.isDragging(),
    }),
    type: 'question',
  })

  return (
    <div className="flex w-full mb-4 h-max flex-col-2">
      <div className="min-h-full my-auto mr-2">
        <Checkbox checked={checked} onCheck={onCheck} />
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
            <div className="flex flex-row">
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
              {/* // TODO: remove once seeding is no longer done manually */}
              <div>QuestionId: {id}</div>
            </div>
            <div className="mb-2 italic">{QUESTION_TYPES_SHORT[type]}</div>
            <div className="flex-1 mb-2">
              {content.length > 120
                ? `${content.substring(0, 120)}...`
                : content}
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
            {isPreviewModalOpen && (
              <QuestionPreviewModal
                handleSetIsOpen={setIsPreviewModalOpen}
                isOpen={isPreviewModalOpen}
                questionId={id}
              />
            )}
          </div>
          <div className="mb-2 md:mr-3 w-36 md:mb-0">
            <Button
              className="justify-center h-10 bg-red-300 w-36"
              onClick={() =>
                deleteQuestion({
                  variables: {
                    id,
                  },
                  refetchQueries: [{ query: GetUserQuestionsDocument }],
                })
              }
            >
              Löschen
            </Button>
          </div>
          <div className="mb-2 md:mr-3 w-36 md:mb-0">
            <Button
              className="justify-center h-10 bg-white w-36"
              onClick={(): void => setIsModificationModalOpen(true)}
            >
              Bearbeiten
            </Button>
            {isModificationModalOpen && (
              <QuestionEditModal
                handleSetIsOpen={setIsModificationModalOpen}
                isOpen={isModificationModalOpen}
                questionId={id}
                mode="EDIT"
              />
            )}
          </div>
          <div className="w-36">
            <Button
              className="justify-center h-10 bg-white w-36"
              onClick={(): void => setIsDuplicationModalOpen(true)}
              // TODO: implement
              disabled
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
