import { useQuery } from '@apollo/client'
import {
  faArchive,
  faEllipsis,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Element as ElementObject,
  ElementStatus,
  type ElementType,
  ObjectType,
  type Tag,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Badge, Button, Checkbox, Dropdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import React, { useCallback, useState } from 'react'
import { useDrag } from 'react-dnd'
import { twMerge } from 'tailwind-merge'
import ActivityLogDialog from '../sharing/ActivityLogDialog'
import ObjectPermissionLevel from '../sharing/ObjectPermissionLevel'
import ObjectSharingModalWrapper from '../sharing/ObjectSharingModalWrapper'
import SharingTypeBadge from '../sharing/SharingTypeBadge'
import ElementTags from './ElementTags'
import { parseElementAutoSaveForUser } from './manipulation/elementAutoSave'
import ElementDeletionModal from './manipulation/ElementDeletionModal'
import ElementEditModal, {
  ElementEditMode,
} from './manipulation/ElementEditModal'
import ElementRemovalModal from './manipulation/ElementRemovalModal'
import RecoveryPrompt from './manipulation/RecoveryPrompt'
import useAvailableElementActions from './useAvailableElementActions'
import useElementActions from './useElementActions'

const StatusColors: Record<ElementStatus, string> = {
  [ElementStatus.Draft]: 'bg-slate-400 hover:bg-slate-500',
  [ElementStatus.Review]: 'bg-violet-400 hover:bg-violet-500',
  [ElementStatus.Ready]: 'bg-green-600 hover:bg-green-700',
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
  handleTagClick: (tagId: number) => void
  onCheck: () => void
  triggerSuccessToast: () => void
  hasAnswerFeedbacks: boolean
  hasSampleSolution: boolean
  tagfilter?: string[]
  refetchElements: () => Promise<void>
}

function Element({
  checked = false,
  element,
  disabled,
  tags = [],
  handleTagClick,
  onCheck,
  triggerSuccessToast,
  hasAnswerFeedbacks,
  hasSampleSolution,
  tagfilter = [],
  refetchElements,
}: ElementProps): React.ReactElement {
  const t = useTranslations()
  const [isModificationModalOpen, setModificationModalOpen] = useState(false)
  const [isDuplicationModalOpen, setDuplicationModalOpen] = useState(false)
  const [isRemovalModalOpen, setRemovalModalOpen] = useState(false)
  const [isDeletionModalOpen, setDeletionModalOpen] = useState(false)
  const [isSharingModalOpen, setSharingModalOpen] = useState(false)
  const [isActivityLogOpen, setActivityLogOpen] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)

  // TODO: once the sharing feature is available for all users, remove this feature flag check
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const userId = dataUser?.userProfile?.id
  const editDisabled = disabled || !userId

  const openElementEdit = useCallback(() => {
    if (editDisabled) {
      return
    }

    const autoSaveKey = `autosave-element-${element.id}`
    const serializedValue = localStorage.getItem(autoSaveKey)
    const recoveredElement = parseElementAutoSaveForUser(
      serializedValue,
      userId
    )

    if (recoveredElement) {
      setShowRecoveryPrompt(true)
    } else {
      if (serializedValue !== null) {
        localStorage.removeItem(autoSaveKey)
      }
      setModificationModalOpen(true)
    }
  }, [editDisabled, element.id, userId])

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

  const actions = useElementActions({
    element,
    disabled,
    editDisabled,
    onEdit: openElementEdit,
    setDuplicationModalOpen,
    setDeletionModalOpen,
    setRemovalModalOpen,
    setActivityLogOpen,
    setSharingModalOpen,
  })

  const availableActions = useAvailableElementActions({
    actions,
    permissionActionMap: {
      isManager: [
        ...(dataUser?.userProfile?.privatePreview ? ['shareElement'] : []),
        'deleteElement',
      ],
      isEditor: ['editElement'],
      isShared: ['duplicateElement', 'activityLog'],
      isRemovable: ['removeElement'],
    },
    isEditor: element.isEditor ?? false,
    isManager: element.isManager ?? false,
    isOwner: element.isOwner ?? false,
    isRemovable: element.isRemovable ?? false,
    isShared: element.isShared ?? false,
  })

  return (
    <div className="flex items-center" data-cy={`element-item-${element.name}`}>
      <Checkbox
        disabled={disabled}
        checked={checked}
        onCheck={onCheck}
        className={{ root: 'border-unset mr-1.5' }}
        data={{ cy: `element-checkbox-${element.name}` }}
      />
      {drag(
        <div
          className={twMerge(
            'flex w-full cursor-grab flex-col rounded-lg border border-solid px-3 py-2 hover:shadow-md md:flex-row',
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
                    editDisabled && 'hover:cursor-not-allowed hover:text-black'
                  )}
                  role="button"
                  tabIndex={0}
                  type="button"
                  onClick={() => {
                    openElementEdit()
                  }}
                  data-cy={`element-title-${element.name}`}
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
              </div>

              <div className="flex-1 text-sm">
                <Ellipsis
                  maxLines={2}
                  withMarkdown={false}
                  className={{ root: 'text-left' }}
                >
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

          {element.isArchived && (
            <Badge
              className="mt-1.25 mr-3 flex h-max flex-row items-center gap-2"
              data-cy={`archive-badge-${element.name}`}
            >
              <FontAwesomeIcon icon={faArchive} />
              <span>{t('shared.generic.archived')}</span>
            </Badge>
          )}

          <SharingTypeBadge sharingType={element.sharingType} />

          {element.numSharedUsers && element.isManager ? (
            <div
              className="hover:text-primary-100 mr-3 flex h-max cursor-pointer flex-row items-center gap-2 py-1 text-gray-600"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSharingModalOpen(true)
              }}
            >
              <div>{element.numSharedUsers}</div>
              <FontAwesomeIcon icon={faUserGroup} className="h-4 w-4" />
            </div>
          ) : null}
          <div className="flex flex-row gap-1.5 md:flex-col">
            {availableActions
              .slice(0, availableActions.length > 3 ? 2 : 3)
              .map((action) => {
                return (
                  <Button
                    key={`action-${element.id}-${action.label}`}
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className={{
                      root: twMerge('h-8 w-8 p-0', action.className),
                    }}
                    data={action.data}
                  >
                    <Button.Icon withoutLabel icon={action.icon} />
                  </Button>
                )
              })}

            {availableActions.length > 3 && (
              <Dropdown
                items={availableActions.slice(2).map((action) => ({
                  id: `action-${element.id}-${action.label}`,
                  label: (
                    <div
                      className={twMerge(
                        'flex cursor-pointer items-center rounded hover:bg-gray-100',
                        action.className
                      )}
                    >
                      <FontAwesomeIcon
                        icon={action.icon}
                        className="mr-2.5 h-4 w-4"
                      />
                      {action.label}
                    </div>
                  ),
                  onClick: action.onClick,
                  data: action.data,
                }))}
                trigger={<FontAwesomeIcon icon={faEllipsis} />}
                className={{
                  viewport: 'z-20', // ensure that dropdown is shown above other elements on course overview
                  item: 'py-0.5 text-sm',
                  trigger: 'h-8 w-8 p-0',
                }}
                data={{ cy: `actions-element-${element.name}` }}
              />
            )}
          </div>
        </div>
      )}

      {showRecoveryPrompt && (
        <RecoveryPrompt
          editMode
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
          refetchElements={refetchElements}
        />
      )}
      {isDuplicationModalOpen && (
        <ElementEditModal
          handleSetIsOpen={setDuplicationModalOpen}
          triggerSuccessToast={triggerSuccessToast}
          isOpen={isDuplicationModalOpen}
          elementId={element.id}
          mode={ElementEditMode.DUPLICATE}
          refetchElements={refetchElements}
        />
      )}
      {isDeletionModalOpen && element.isManager && (
        <ElementDeletionModal
          isModalOpen={isDeletionModalOpen}
          setModalOpen={setDeletionModalOpen}
          elementId={element.id}
          title={element.name}
          refetchElements={refetchElements}
        />
      )}
      {isRemovalModalOpen && !element.isOwner && element.isRemovable && (
        <ElementRemovalModal
          isModalOpen={isRemovalModalOpen}
          setModalOpen={setRemovalModalOpen}
          elementId={element.id}
          title={element.name}
          refetchElements={refetchElements}
        />
      )}
      {isSharingModalOpen && element.isManager ? (
        <ObjectSharingModalWrapper
          objectId={element.id}
          objectName={element.name}
          objectType={ObjectType.Element}
          onClose={() => setSharingModalOpen(false)}
          refetchElements={refetchElements}
        />
      ) : null}

      {isActivityLogOpen && (
        <ActivityLogDialog
          objectId={element.id}
          objectType={ObjectType.Element}
          open={isActivityLogOpen}
          onClose={() => setActivityLogOpen(false)}
        />
      )}
    </div>
  )
}

export default Element
