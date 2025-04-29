import { faCopy, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArchive,
  faEllipsis,
  faPencil,
  faShare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Element as ElementObject,
  ElementStatus,
  type ElementType,
  SharingObjectType,
  type Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Checkbox, Dropdown } from '@uzh-bf/design-system'
import { Badge } from '@uzh-bf/design-system/dist/future'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { useDrag } from 'react-dnd'
import { twMerge } from 'tailwind-merge'
import ObjectPermissionLevel from '../sharing/ObjectPermissionLevel'
import ObjectSharingModalWrapper from '../sharing/ObjectSharingModalWrapper'
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
  element: ElementObject
  tags?: Tag[]
  handleTagClick: (tagName: string) => void
  onCheck: () => void
  triggerSuccessToast: () => void
  unsetDeletedQuestion: (questionId: number) => void
  hasAnswerFeedbacks: boolean
  hasSampleSolution: boolean
  tagfilter?: string[]
}

function Element({
  checked = false,
  element,
  tags = [],
  handleTagClick,
  onCheck,
  triggerSuccessToast,
  unsetDeletedQuestion,
  hasAnswerFeedbacks,
  hasSampleSolution,
  tagfilter = [],
}: ElementProps): React.ReactElement {
  const t = useTranslations()
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false)
  const [isDuplicationModalOpen, setIsDuplicationModalOpen] = useState(false)
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)

  const [collectedProps, drag] = useDrag({
    item: {
      id: element.id,
      type: element.type,
      questionType: element.type,
      title: element.name,
      content: element.content,
      hasAnswerFeedbacks,
      hasSampleSolution,
    },
    collect: (monitor): any => ({
      isDragging: monitor.isDragging(),
    }),
    type: element.type,
  })

  return (
    <div className="flex items-center" data-cy={`element-item-${element.name}`}>
      <Checkbox
        checked={checked}
        onCheck={onCheck}
        className={{ root: 'mr-1.5' }}
      />
      {drag(
        <div
          className={twMerge(
            'flex w-full cursor-[grab] flex-col rounded-lg border border-solid px-3 py-2 hover:shadow-md md:flex-row',
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
                  {element.name}
                  {element.permissionLevel && (
                    <ObjectPermissionLevel
                      permissionLevel={element.permissionLevel}
                      className="ml-3"
                    />
                  )}
                </a>

                {element.isArchived && <FontAwesomeIcon icon={faArchive} />}
              </div>

              <div className="flex-1 text-sm">
                <Ellipsis maxLines={2} withMarkdown={false}>
                  {element.content}
                </Ellipsis>
              </div>

              <div className="flex flex-none flex-col gap-1 text-sm text-slate-600 md:flex-row md:gap-4">
                <div className="w-20">
                  <Badge className={twMerge(StatusColors[element.status])}>
                    {t(`shared.${element.status}.statusLabel`)}
                  </Badge>
                </div>
                <div className="w-36">
                  {t(`shared.${element.type}.typeLabel`)}
                </div>
                <div>
                  {t('shared.generic.createdAt', {
                    date: dayjs(element.createdAt).format('DD.MM.YYYY HH:mm'),
                  })}
                </div>
                <div>
                  {t('shared.generic.updatedAt', {
                    date: dayjs(element.updatedAt).format('DD.MM.YYYY HH:mm'),
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
            {element.isEditor ? (
              <Button
                className={{ root: 'h-8 w-8 p-0' }}
                onClick={() => {
                  const value = localStorage.getItem(
                    `autosave-element-${element.id}`
                  )

                  if (value) {
                    setShowRecoveryPrompt(true)
                  } else {
                    setIsModificationModalOpen(true)
                  }
                }}
                data={{ cy: `edit-element-${element.name}` }}
              >
                <Button.Icon withoutLabel icon={faPencil} />
              </Button>
            ) : null}

            <Button
              className={{ root: 'h-8 w-8 p-0' }}
              onClick={() => setIsDuplicationModalOpen(true)}
              data={{ cy: `duplicate-element-${element.name}` }}
            >
              <Button.Icon withoutLabel icon={faCopy} />
            </Button>

            {element.isManager ? (
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
                    data: { cy: `delete-element-${element.name}` },
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
                    data: { cy: `share-element-${element.name}` },
                  },
                ]}
                trigger={
                  <Button
                    className={{ root: 'h-8 w-8 p-0' }}
                    data={{ cy: `actions-element-${element.name}` }}
                  >
                    <Button.Icon withoutLabel icon={faEllipsis} />
                  </Button>
                }
              />
            ) : null}
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
            localStorage.removeItem(`autosave-element-${element.id}`)
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
          elementId={element.id}
          mode={ElementEditMode.EDIT}
        />
      )}
      {isDuplicationModalOpen && (
        <ElementEditModal
          handleSetIsOpen={setIsDuplicationModalOpen}
          triggerSuccessToast={triggerSuccessToast}
          isOpen={isDuplicationModalOpen}
          elementId={element.id}
          mode={ElementEditMode.DUPLICATE}
        />
      )}
      {isDeletionModalOpen && (
        <ElementDeletionModal
          isModalOpen={isDeletionModalOpen}
          setModalOpen={setIsDeletionModalOpen}
          elementId={element.id}
          type={element.type}
          title={element.name}
          content={element.content}
          unsetDeletedQuestion={unsetDeletedQuestion}
        />
      )}
      {isSharingModalOpen && (
        <ObjectSharingModalWrapper
          objectId={element.id}
          objectName={element.name}
          objectType={SharingObjectType.Element}
          isOwner={element.isOwner ?? false}
          open={isSharingModalOpen}
          onClose={() => setIsSharingModalOpen(false)}
        />
      )}
    </div>
  )
}

export default Element
