import { Button, Checkbox, H2, H3, Modal } from '@uzh-bf/design-system'
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
    <div className="flex w-full mb-4 h-max flex-col-2">
      <div className="min-h-full my-auto mr-2">
        <Checkbox checked={checked} onCheck={onCheck} />
      </div>
      <div
        className={twMerge(
          'flex flex-row w-full p-3 border border-solid rounded-lg cursor-[grab] hover:shadow-md',
          collectedProps.isDragging && 'opacity-50'
        )}
        ref={drag}
        data-cy="question-block"
      >
        <div className="flex flex-row flex-1">
          <div className="flex flex-col flex-1">
            {isArchived && <div>ARCHIVED // TODO styling</div>}
            <div className="flex flex-row flex-none mb-2">
              <a
                className="flex-1 text-xl font-bold cursor-pointer text-primary-strong hover:text-uzh-blue-100"
                role="button"
                tabIndex={0}
                type="button"
                onClick={() => setIsModificationModalOpen(true)}
                onKeyDown={() => setIsModificationModalOpen(true)}
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

            <div className="flex flex-row flex-none gap-8 text-sm text-slate-600">
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

        <div className="flex flex-col md:flex-row md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="w-36">
              <Button
                className={{ root: 'w-36' }}
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
                className={{ root: 'bg-white w-36' }}
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
            <div className="w-36">
              <Button
                className={{
                  root: 'w-36 border-red-400',
                }}
                onClick={() => setIsDeletionModalOpen(true)}
              >
                Löschen
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
                    Sind Sie sich sicher, dass Sie die folgende(n) Frage(n)
                    löschen möchten?
                  </div>
                  <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
                    <H3>
                      {title} ({QUESTION_TYPES_SHORT[type]})
                    </H3>
                    <div>{content}</div>
                  </div>
                  <div className="mt-6 mb-2 text-sm italic">
                    Gelöschte Fragen können nicht wiederhergestellt werden. Aus
                    bestehenden Sessionen werden gelöschte Fragen nicht
                    entfernt.
                  </div>
                </div>
              </Modal>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Question
