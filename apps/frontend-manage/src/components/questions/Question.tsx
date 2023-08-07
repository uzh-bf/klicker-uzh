import { Button, Checkbox, H2, H3, Modal } from '@uzh-bf/design-system'
import React, { useState } from 'react'
import { useDrag } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

import { QUESTION_TYPES_SHORT } from '@klicker-uzh/shared-components/src/constants'

// TODO: readd modals and tags
// import QuestionDetailsModal from './QuestionDetailsModal'
// import QuestionDuplicationModal from './QuestionDuplicationModal'
import { useMutation } from '@apollo/client'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteQuestionDocument,
  GetUserQuestionsDocument,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import dayjs from 'dayjs'
import QuestionEditModal from './QuestionEditModal'
import QuestionTags from './QuestionTags'
// import QuestionTags from './QuestionTags'

interface Props {
  checked: boolean
  id: number
  isArchived?: boolean
  tags?: Tag[]
  title: string
  type: string
  content: string
  onCheck: any // TODO: typing
  hasAnswerFeedbacks: boolean
  hasSampleSolution: boolean
  tagfilter?: string[]
  createdAt?: string
  updatedAt?: string
}

function Question({
  checked = false,
  id,
  tags = [],
  title,
  type,
  content,
  onCheck,
  isArchived = false,
  hasAnswerFeedbacks,
  hasSampleSolution,
  tagfilter = [],
  createdAt,
  updatedAt,
}: Props): React.ReactElement {
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false)
  const [isDuplicationModalOpen, setIsDuplicationModalOpen] = useState(false)
  // TODO: add preview modal with student view of question
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)
  const [deleteQuestion] = useMutation(DeleteQuestionDocument)

  const [collectedProps, drag] = useDrag({
    item: {
      id,
      type: 'question',
      questionType: type,
      title,
      content,
      hasAnswerFeedbacks,
      hasSampleSolution,
    },
    collect: (monitor): any => ({
      isDragging: monitor.isDragging(),
    }),
    type: 'question',
  })

  return (
    <div className="flex gap-1 items-center" data-cy="question-block">
      <Checkbox checked={checked} onCheck={onCheck} />

      <div
        className={twMerge(
          'flex flex-col md:flex-row w-full p-3 gap-2 border border-solid rounded-lg cursor-[grab] sm:hover:shadow-md',
          collectedProps.isDragging && 'opacity-50'
        )}
        ref={drag}
      >
        <div className="flex flex-row flex-1">
          <div className="flex flex-col flex-1 gap-1">
            {isArchived && <div>ARCHIVED // TODO styling</div>}

            <div className="flex flex-row flex-none">
              <a
                className="flex-1 text-xl font-bold cursor-pointer text-primary-strong sm:hover:text-uzh-blue-100"
                role="button"
                tabIndex={0}
                type="button"
                onClick={() => setIsModificationModalOpen(true)}
                onKeyDown={() => setIsModificationModalOpen(true)}
                data-cy="question-title"
              >
                {type} - {title}
              </a>
            </div>

            <div className="flex-1">
              <Ellipsis
                // maxLines={3}
                maxLength={120}
              >
                {content}
              </Ellipsis>
            </div>

            <div className="flex flex-col md:flex-row flex-none gap-1 md:gap-4 text-sm text-slate-600">
              <div>
                Erstellt am {dayjs(createdAt).format('DD.MM.YYYY HH:mm')}
              </div>
              <div>
                Editiert am {dayjs(updatedAt).format('DD.MM.YYYY HH:mm')}
              </div>
            </div>
          </div>
          <div className="hidden mr-6 w-max md:block">
            <QuestionTags tags={tags} tagfilter={tagfilter} />
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-2">
          <Button
            className={{
              root: 'bg-white md:w-36 text-sm md:text-base space-x-2',
            }}
            onClick={(): void => setIsModificationModalOpen(true)}
            data={{ cy: 'edit-question' }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faPencil} />
            </Button.Icon>
            <Button.Label>Bearbeiten</Button.Label>
          </Button>
          {isModificationModalOpen && (
            <QuestionEditModal
              handleSetIsOpen={setIsModificationModalOpen}
              isOpen={isModificationModalOpen}
              questionId={id}
              mode={QuestionEditModal.Mode.EDIT}
            />
          )}
          <Button
            className={{
              root: 'bg-white text-sm md:text-base md:w-36 space-x-2',
            }}
            onClick={(): void => setIsDuplicationModalOpen(true)}
            data={{ cy: `duplicate-question-${title}` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faCopy} />
            </Button.Icon>
            <Button.Label>Duplizieren</Button.Label>
          </Button>
          {isDuplicationModalOpen && (
            <QuestionEditModal
              handleSetIsOpen={setIsDuplicationModalOpen}
              isOpen={isDuplicationModalOpen}
              questionId={id}
              mode={QuestionEditModal.Mode.DUPLICATE}
            />
          )}
          <Button
            className={{
              root: 'text-sm md:text-base md:w-36 border-red-400 space-x-2',
            }}
            onClick={() => setIsDeletionModalOpen(true)}
            data={{ cy: `delete-question-${title}` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faTrash} />
            </Button.Icon>
            <Button.Label>Löschen</Button.Label>
          </Button>
          <Modal
            onPrimaryAction={
              <Button
                onClick={async () => {
                  await deleteQuestion({
                    variables: {
                      id,
                    },
                    refetchQueries: [{ query: GetUserQuestionsDocument }],
                  })
                  setIsDeletionModalOpen(false)
                }}
                className={{ root: 'bg-red-600 font-bold text-white' }}
                data={{ cy: 'confirm-question-deletion' }}
              >
                Löschen
              </Button>
            }
            onSecondaryAction={
              <Button onClick={(): void => setIsDeletionModalOpen(false)}>
                Abbrechen
              </Button>
            }
            onClose={(): void => setIsDeletionModalOpen(false)}
            open={isDeletionModalOpen}
            hideCloseButton={true}
            className={{ content: 'w-[40rem] h-max self-center pt-0' }}
          >
            <div>
              <H2>Frage löschen</H2>
              <div>
                Sind Sie sich sicher, dass Sie die folgende(n) Frage(n) löschen
                möchten?
              </div>
              <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
                <H3>
                  {title} ({QUESTION_TYPES_SHORT[type]})
                </H3>
                <div>{content}</div>
              </div>
              <div className="mt-6 mb-2 text-sm italic">
                Gelöschte Fragen können nicht wiederhergestellt werden. Aus
                bestehenden Sessionen werden gelöschte Fragen nicht entfernt.
              </div>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  )
}

export default Question
