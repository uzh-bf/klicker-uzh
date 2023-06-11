import { useMutation } from '@apollo/client'
import FlashcardSetPublishToast from '@components/toasts/FlashcardSetPublishToast'
import {
  faPencil,
  faPeopleGroup,
  faTrash,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  FlashcardSet,
  FlashcardSetStatus,
  PublishFlashcardSetDocument,
  UnpublishFlashcardSetDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, H3 } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import StatusTag from './StatusTag'

interface FlashcardStackProps {
  flashcardSet: FlashcardSet
}

function FlashcardStack({ flashcardSet }: FlashcardStackProps) {
  const [publishFlashcardSet] = useMutation(PublishFlashcardSetDocument)
  const [unpublishFlashcardSet] = useMutation(UnpublishFlashcardSetDocument)

  const [publishToast, showPublishToast] = useState(false)
  const [publishingFailed, setPublishingFailed] = useState(false)
  const [newPublishState, setNewPublishState] = useState(false)

  const stylestring =
    'absolute h-44 bg-white rounded-lg w-64 border border-solid border-uzh-grey-40 shadow p-2'

  // TODO: move to translations once internationalization is implemented
  const statusMap = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
  }

  return (
    <div>
      <div className="relative w-64 h-44">
        <div className={twMerge(stylestring, 'z-0  -rotate-6')} />
        <div className={twMerge(stylestring, 'z-5  -rotate-3')} />
        <div
          className={twMerge(stylestring, 'z-10 flex flex-col justify-between')}
        >
          <div>
            <div className="flex flex-row justify-between gap-2">
              <H3>
                <Ellipsis maxLength={30}>{flashcardSet.name}</Ellipsis>
              </H3>
              <Button
                className={{
                  root: twMerge(
                    'h-7 w-7 flex justify-center items-center',
                    flashcardSet.status !== FlashcardSetStatus.Published &&
                      'bg-red-600 text-white'
                  ),
                }}
                disabled={flashcardSet.status === FlashcardSetStatus.Published}
                onClick={async () => {
                  // TODO: add deletion function
                  return null
                }}
              >
                <FontAwesomeIcon icon={faTrash} size="sm" />
              </Button>
            </div>
            <div className="mb-1 italic">
              {flashcardSet.numOfFlashcards} Flashcards
            </div>
            <StatusTag
              status={statusMap[flashcardSet.status]}
              type={flashcardSet.status}
            />
          </div>
          <div className="flex flex-row justify-end w-full gap-2">
            {flashcardSet.status !== FlashcardSetStatus.Published && (
              <Button
                className={{ root: 'text-sm h-7 flex flex-row gap-2' }}
                onClick={() => {
                  // TODO redirect to edit page / creation page with pre-filled data
                  return null
                }}
              >
                <FontAwesomeIcon icon={faPencil} />
                <div>Edit</div>
              </Button>
            )}
            {flashcardSet.status !== FlashcardSetStatus.Published && (
              <Button
                className={{ root: 'text-sm h-7' }}
                onClick={async () => {
                  // TODO: add confirmation modal
                  const result = await publishFlashcardSet({
                    variables: {
                      id: flashcardSet.id,
                    },
                  })

                  if (result.data?.publishFlashcardSet) {
                    setPublishingFailed(false)
                    setNewPublishState(true)
                    showPublishToast(true)
                  } else {
                    setPublishingFailed(true)
                    setNewPublishState(true)
                    showPublishToast(true)
                  }
                }}
              >
                <FontAwesomeIcon icon={faPeopleGroup} />
                <div>Publish</div>
              </Button>
            )}
            {flashcardSet.status === FlashcardSetStatus.Published && (
              <Button
                className={{ root: 'text-sm h-7' }}
                onClick={async () => {
                  // TODO: add confirmation modal
                  const result = await unpublishFlashcardSet({
                    variables: {
                      id: flashcardSet.id,
                    },
                  })

                  if (result.data?.unpublishFlashcardSet) {
                    setPublishingFailed(false)
                    setNewPublishState(false)
                    showPublishToast(true)
                  } else {
                    setPublishingFailed(true)
                    setNewPublishState(false)
                    showPublishToast(true)
                  }
                }}
              >
                <FontAwesomeIcon icon={faX} />
                <div>Unpublish</div>
              </Button>
            )}
          </div>
        </div>
      </div>
      <FlashcardSetPublishToast
        failed={publishingFailed}
        newPublish={newPublishState}
        open={publishToast}
        setOpen={showPublishToast}
      />
    </div>
  )
}

export default FlashcardStack
