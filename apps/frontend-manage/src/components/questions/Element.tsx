import { faCopy, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArchive,
  faEllipsis,
  faPencil,
  faShare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CatalogObjectType,
  ElementStatus,
  ElementType,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Checkbox, Dropdown } from '@uzh-bf/design-system'
import { Badge } from '@uzh-bf/design-system/dist/future'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { useDrag } from 'react-dnd'
import { twMerge } from 'tailwind-merge'
import ObjectSharingModal from '../sharing/ObjectSharingModal'
import ElementTags from './ElementTags'
import ElementDeletionModal from './manipulation/ElementDeletionModal'
import ElementEditModal, {
  ElementEditMode,
} from './manipulation/ElementEditModal'
import RecoveryPrompt from './manipulation/RecoveryPrompt'

const StatusColors: Record<ElementStatus, string> = {
  [ElementStatus.Draft]: 'bg-slate-400',
  [ElementStatus.Review]: 'bg-violet-400',
  [ElementStatus.Ready]: 'bg-green-400',
}

export interface ElementDragDropTypes {
  id: number
  type: ElementType
  questionType: ElementType
  title: string
  content: string
  hasAnswerFeedbacks: boolean
  hasSampleSolution: boolean
}

interface ElementProps {
  checked: boolean
  id: number
  isArchived?: boolean
  tags?: Tag[]
  handleTagClick: (tagName: string) => void
  title: string
  status: ElementStatus
  type: ElementType
  content: string
  onCheck: () => void
  triggerSuccessToast: () => void
  unsetDeletedQuestion: (questionId: number) => void
  hasAnswerFeedbacks: boolean
  hasSampleSolution: boolean
  tagfilter?: string[]
  createdAt?: string
  updatedAt?: string
}

function Element({
  checked = false,
  id,
  tags = [],
  handleTagClick,
  title,
  status,
  type,
  content,
  onCheck,
  triggerSuccessToast,
  unsetDeletedQuestion,
  isArchived = false,
  hasAnswerFeedbacks,
  hasSampleSolution,
  tagfilter = [],
  createdAt,
  updatedAt,
}: ElementProps): React.ReactElement {
  const t = useTranslations()
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false)
  const [isDuplicationModalOpen, setIsDuplicationModalOpen] = useState(false)
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)

  const [collectedProps, drag] = useDrag({
    item: {
      id,
      type,
      questionType: type,
      title,
      content,
      hasAnswerFeedbacks,
      hasSampleSolution,
    },
    collect: (monitor): any => ({
      isDragging: monitor.isDragging(),
    }),
    type,
  })

  return (
    <div className="flex items-center" data-cy={`element-item-${title}`}>
      <Checkbox
        checked={checked}
        onCheck={onCheck}
        className={{ root: 'mr-1.5' }}
      />
      {drag(
        <div
          className={twMerge(
            'flex w-full cursor-[grab] flex-col gap-2 rounded-lg border border-solid px-3 py-2 hover:shadow-md md:flex-row',
            collectedProps.isDragging && 'opacity-50'
          )}
        >
          <div className="flex flex-1 flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-none flex-row items-center gap-2 text-lg">
                <a
                  className="hover:text-uzh-blue-100 inline-flex flex-1 cursor-pointer items-center text-lg font-bold"
                  role="button"
                  tabIndex={0}
                  type="button"
                  onClick={() => setIsModificationModalOpen(true)}
                  onKeyDown={() => setIsModificationModalOpen(true)}
                  data-cy="question-title"
                >
                  {title}
                </a>

                {isArchived && (
                  <FontAwesomeIcon title="ARCHIVE" icon={faArchive} />
                )}
              </div>

              <div className="flex-1 text-sm">
                <Ellipsis maxLines={2} withMarkdown={false}>
                  {content}
                </Ellipsis>
              </div>

              <div className="flex flex-none flex-col gap-1 text-sm text-slate-600 md:flex-row md:gap-4">
                <div className="w-20">
                  <Badge className={twMerge(StatusColors[status])}>
                    {t(`shared.${status}.statusLabel`)}
                  </Badge>
                </div>
                <div className="w-36">{t(`shared.${type}.typeLabel`)}</div>
                <div>
                  {t('shared.generic.createdAt', {
                    date: dayjs(createdAt).format('DD.MM.YYYY HH:mm'),
                  })}
                </div>
                <div>
                  {t('shared.generic.updatedAt', {
                    date: dayjs(updatedAt).format('DD.MM.YYYY HH:mm'),
                  })}
                </div>
              </div>
            </div>
            <div className="mr-6 hidden w-max md:block">
              <ElementTags
                tags={tags}
                tagfilter={tagfilter}
                handleTagClick={handleTagClick}
              />
            </div>
          </div>

          <div className="flex flex-row gap-1.5 md:flex-col">
            <Button
              className={{ root: 'h-8 w-8 p-0' }}
              onClick={() => {
                const value = localStorage.getItem(`autosave-element-${id}`)

                if (value) {
                  setShowRecoveryPrompt(true)
                } else {
                  setIsModificationModalOpen(true)
                }
              }}
              data={{ cy: `edit-element-${title}` }}
            >
              <Button.Icon withoutLabel icon={faPencil} />
            </Button>

            <Button
              className={{ root: 'h-8 w-8 p-0' }}
              onClick={() => setIsDuplicationModalOpen(true)}
              data={{ cy: `duplicate-element-${title}` }}
            >
              <Button.Icon withoutLabel icon={faCopy} />
            </Button>

            <Dropdown
              items={[
                {
                  label: (
                    <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100">
                      <FontAwesomeIcon
                        icon={faTrashCan}
                        className="mr-2.5 h-4 w-4"
                      />
                      {t('manage.elements.deleteElement')}
                    </div>
                  ),
                  onClick: () => setIsDeletionModalOpen(true),
                  data: { cy: `delete-element-${title}` },
                },
                {
                  label: (
                    <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
                      <FontAwesomeIcon
                        icon={faShare}
                        className="mr-2.5 h-4 w-4"
                      />
                      {t('manage.elements.shareElement')}
                    </div>
                  ),
                  onClick: () => setIsSharingModalOpen(true),
                  data: { cy: `share-element-${title}` },
                },
              ]}
              trigger={
                <Button
                  className={{ root: 'h-8 w-8 p-0' }}
                  data={{ cy: `actions-element-${title}` }}
                >
                  <Button.Icon withoutLabel icon={faEllipsis} />
                </Button>
              }
            />
          </div>
        </div>
      )}
      {showRecoveryPrompt && (
        <RecoveryPrompt
          editMode
          open={showRecoveryPrompt}
          onRecovery={() => {
            setShowRecoveryPrompt(false)
            setIsModificationModalOpen(true)
          }}
          onDiscard={() => {
            localStorage.removeItem(`autosave-element-${id}`)
            setShowRecoveryPrompt(false)
            setIsModificationModalOpen(true)
          }}
        />
      )}
      {isModificationModalOpen && (
        <ElementEditModal
          handleSetIsOpen={setIsModificationModalOpen}
          triggerSuccessToast={triggerSuccessToast}
          isOpen={isModificationModalOpen}
          elementId={id}
          mode={ElementEditMode.EDIT}
        />
      )}
      {isDuplicationModalOpen && (
        <ElementEditModal
          handleSetIsOpen={setIsDuplicationModalOpen}
          triggerSuccessToast={triggerSuccessToast}
          isOpen={isDuplicationModalOpen}
          elementId={id}
          mode={ElementEditMode.DUPLICATE}
        />
      )}
      {isDeletionModalOpen && (
        <ElementDeletionModal
          isModalOpen={isDeletionModalOpen}
          setModalOpen={setIsDeletionModalOpen}
          elementId={id}
          type={type}
          title={title}
          content={content}
          unsetDeletedQuestion={unsetDeletedQuestion}
        />
      )}
      {isSharingModalOpen && (
        <ObjectSharingModal // TODO: replace with wrapper and update function arguments
          derivedPermissionsAvailable
          open={isSharingModalOpen}
          onClose={() => setIsSharingModalOpen(false)}
          objectId={id}
          objectType={CatalogObjectType.Element}
          objectName={title}
          onOwnershipTransfer={() => {}} // TODO: pass down function to transfer ownership -> afterwards check if function works as expected
          isOwner={false} // TODO: get from fetched element data
        />
      )}
    </div>
  )
}

export default Element
