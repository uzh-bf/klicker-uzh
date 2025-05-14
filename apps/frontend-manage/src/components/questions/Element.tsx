import { useQuery } from '@apollo/client'
import { faCopy, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArchive,
  faEllipsis,
  faPencil,
  faShare,
  faUserGroup,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Element as ElementObject,
  ElementStatus,
  type ElementType,
  SharingObjectType,
  type Tag,
  UserProfileDocument,
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
import SharingTypeBadge from '../sharing/SharingTypeBadge'
import ElementTags from './ElementTags'
import ElementDeletionModal from './manipulation/ElementDeletionModal'
import ElementEditModal, {
  ElementEditMode,
} from './manipulation/ElementEditModal'
import ElementRemovalModal from './manipulation/ElementRemovalModal'
import RecoveryPrompt from './manipulation/RecoveryPrompt'

const StatusColors: Record<ElementStatus, string> = {
  [ElementStatus.Draft]: 'bg-slate-400 hover:bg-slate-500',
  [ElementStatus.Review]: 'bg-violet-400 hover:bg-violet-500',
  [ElementStatus.Ready]: 'bg-green-400 hover:bg-green-500',
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
  disabled: boolean
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
  disabled,
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
  const [isModificationModalOpen, setModificationModalOpen] = useState(false)
  const [isDuplicationModalOpen, setDuplicationModalOpen] = useState(false)
  const [isRemovalModalOpen, setRemovalModalOpen] = useState(false)
  const [isDeletionModalOpen, setDeletionModalOpen] = useState(false)
  const [isSharingModalOpen, setSharingModalOpen] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)

  // TODO: once the sharing feature is available for all users, remove this feature flag check
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

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
    canDrag: () => !disabled,
    type: element.type,
  })

  return (
    <div className="flex items-center" data-cy={`element-item-${element.name}`}>
      <Checkbox
        disabled={disabled}
        checked={checked}
        onCheck={onCheck}
        className={{ root: 'mr-1.5' }}
      />
      {drag(
        <div
          className={twMerge(
            'flex w-full cursor-[grab] flex-col rounded-lg border border-solid px-3 py-2 hover:shadow-md md:flex-row',
            collectedProps.isDragging && 'opacity-50',
            disabled && 'cursor-not-allowed opacity-50 hover:shadow-none'
          )}
        >
          <div className="flex flex-1 flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-none flex-row items-center gap-2 text-lg">
                <a
                  className={twMerge(
                    'hover:text-uzh-blue-100 inline-flex flex-1 cursor-pointer items-center text-lg font-bold',
                    disabled && 'hover:cursor-not-allowed hover:text-black'
                  )}
                  role="button"
                  tabIndex={0}
                  type="button"
                  onClick={() => {
                    if (!disabled) {
                      setModificationModalOpen(true)
                    }
                  }}
                  data-cy="question-title"
                >
                  {element.name}
                  {element.permissionLevel && (
                    <ObjectPermissionLevel
                      objectName={element.name}
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

          <SharingTypeBadge sharingType={element.sharingType} />

          {element.numSharedUsers && element.isManager ? (
            <div className="mr-3 flex h-max flex-row items-center gap-2 py-1">
              <div>{element.numSharedUsers}</div>
              <FontAwesomeIcon icon={faUserGroup} className="h-4 w-4" />
            </div>
          ) : null}
          <div className="flex flex-row gap-1.5 md:flex-col">
            {element.isEditor ? (
              <Button
                disabled={disabled}
                onClick={() => {
                  const value = localStorage.getItem(
                    `autosave-element-${element.id}`
                  )

                  if (value) {
                    setShowRecoveryPrompt(true)
                  } else {
                    setModificationModalOpen(true)
                  }
                }}
                className={{ root: 'h-8 w-8 p-0' }}
                data={{ cy: `edit-element-${element.name}` }}
              >
                <Button.Icon withoutLabel icon={faPencil} />
              </Button>
            ) : null}

            <Button
              disabled={disabled}
              onClick={() => setDuplicationModalOpen(true)}
              className={{ root: 'h-8 w-8 p-0' }}
              data={{ cy: `duplicate-element-${element.name}` }}
            >
              <Button.Icon withoutLabel icon={faCopy} />
            </Button>

            {element.isManager && !dataUser?.userProfile?.privatePreview ? (
              <Button
                disabled={disabled}
                onClick={() => setDeletionModalOpen(true)}
                className={{
                  root: 'h-8 w-8 border-red-600 p-0 text-red-600 hover:text-red-600',
                }}
                data={{ cy: `delete-element-${element.name}` }}
              >
                <Button.Icon withoutLabel icon={faTrashCan} />
              </Button>
            ) : null}

            {element.isShared &&
            !element.isManager &&
            !element.derivedAccess &&
            element.isRemovable ? (
              <Button
                disabled={disabled}
                onClick={() => setRemovalModalOpen(true)}
                className={{
                  root: 'h-8 w-8 border-red-600 p-0 text-red-600 hover:text-red-600',
                }}
                data={{ cy: `remove-element-${element.name}` }}
              >
                <Button.Icon withoutLabel icon={faX} />
              </Button>
            ) : null}

            {element.isManager && dataUser?.userProfile?.privatePreview ? (
              <Dropdown
                disabled={disabled}
                className={{ item: 'text-sm' }}
                items={[
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
                    onClick: () => setSharingModalOpen(true),
                    data: { cy: `share-element-${element.name}` },
                  },
                  ...(element.isManager &&
                  !element.isOwner &&
                  !element.derivedAccess &&
                  element.isRemovable
                    ? [
                        {
                          label: (
                            <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100">
                              <FontAwesomeIcon
                                icon={faX}
                                className="mr-2.5 h-4 w-4"
                              />
                              {t('manage.questionPool.removeElement')}
                            </div>
                          ),
                          onClick: () => setRemovalModalOpen(true),
                          data: { cy: `remove-element-${element.name}` },
                        },
                      ]
                    : []),
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
                    onClick: () => setDeletionModalOpen(true),
                    data: { cy: `delete-element-${element.name}` },
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
            setModificationModalOpen(true)
          }}
          onDiscard={() => {
            localStorage.removeItem(`autosave-element-${element.id}`)
            setShowRecoveryPrompt(false)
            setModificationModalOpen(true)
          }}
        />
      )}
      {isModificationModalOpen && (
        <ElementEditModal
          inputsDisabled={!element.isEditor}
          handleSetIsOpen={setModificationModalOpen}
          triggerSuccessToast={triggerSuccessToast}
          isOpen={isModificationModalOpen}
          elementId={element.id}
          mode={ElementEditMode.EDIT}
        />
      )}
      {isDuplicationModalOpen && (
        <ElementEditModal
          handleSetIsOpen={setDuplicationModalOpen}
          triggerSuccessToast={triggerSuccessToast}
          isOpen={isDuplicationModalOpen}
          elementId={element.id}
          mode={ElementEditMode.DUPLICATE}
        />
      )}
      {isDeletionModalOpen && element.isManager && (
        <ElementDeletionModal
          isModalOpen={isDeletionModalOpen}
          setModalOpen={setDeletionModalOpen}
          elementId={element.id}
          title={element.name}
          unsetDeletedQuestion={unsetDeletedQuestion}
        />
      )}
      {isRemovalModalOpen && !element.isOwner && element.isRemovable && (
        <ElementRemovalModal
          isModalOpen={isRemovalModalOpen}
          setModalOpen={setRemovalModalOpen}
          elementId={element.id}
          title={element.name}
          unsetDeletedQuestion={unsetDeletedQuestion}
        />
      )}
      {isSharingModalOpen && element.isManager && (
        <ObjectSharingModalWrapper
          objectId={element.id}
          objectName={element.name}
          objectType={SharingObjectType.Element}
          isOwner={element.isOwner ?? false}
          open={isSharingModalOpen}
          onClose={() => setSharingModalOpen(false)}
        />
      )}
    </div>
  )
}

export default Element
