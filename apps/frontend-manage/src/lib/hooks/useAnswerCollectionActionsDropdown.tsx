import { faEye, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpFromBracket,
  faInfoCircle,
  faPencil,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

function useAnswerCollectionActionsDropdown({
  isOwner,
  isManager,
  isEditor,
  isRemovable,
  setSharingModal,
  setEditModal,
  setViewingModal,
  setRemovalModal,
  setDeletionModal,
}: {
  isOwner: boolean
  isManager: boolean
  isEditor: boolean
  isRemovable: boolean
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setEditModal: Dispatch<SetStateAction<boolean>>
  setViewingModal: Dispatch<SetStateAction<boolean>>
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setDeletionModal: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  return useMemo(() => {
    const items = []
    const DeletionTooltip = () => (
      <Tooltip
        tooltip={t('manage.resources.deletionDisabledInUse')}
        className={{
          tooltip: 'max-w-[30rem] text-sm',
          trigger: 'ml-2',
        }}
      >
        <FontAwesomeIcon icon={faInfoCircle} className="text-primary-100" />
      </Tooltip>
    )

    // sharing functionalities
    if (isManager) {
      items.push({
        id: 'share',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
            <FontAwesomeIcon
              icon={faArrowUpFromBracket}
              className="mr-2.5 h-4 w-4"
            />
            {t('manage.resources.shareCollection')}
          </div>
        ),
        onClick: () => setSharingModal(true),
        data: { cy: 'share-answer-collection' },
      })
    }

    if (isEditor) {
      // editing permissions on the answer collection
      items.push({
        id: 'edit',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
            <FontAwesomeIcon icon={faPencil} className="mr-2.5 h-4 w-4" />
            {t('manage.resources.editCollection')}
          </div>
        ),
        onClick: () => setEditModal(true),
        data: { cy: 'edit-answer-collection' },
      })
    } else {
      // viewing permissions on the answer collection only
      items.push({
        id: 'view',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
            <FontAwesomeIcon icon={faEye} className="mr-2.5 h-4 w-4" />
            {t('manage.resources.viewCollection')}
          </div>
        ),
        onClick: () => setViewingModal(true),
        data: { cy: 'view-answer-collection' },
      })
    }

    if (!isOwner) {
      // removal functionalities
      items.push({
        id: 'remove',
        label: (
          <div
            className={twMerge(
              'flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100',
              !isRemovable && 'text-opactiy-50 hover:cursor-not-allowed'
            )}
          >
            <FontAwesomeIcon icon={faX} className="mr-2.5 h-4 w-4" />
            {t('manage.resources.removeCollection')}
            {!isRemovable && <DeletionTooltip />}
          </div>
        ),
        onClick: () => setRemovalModal(true),
        disabled: !isRemovable,
        data: { cy: 'remove-answer-collection' },
      })
    }

    if (isManager) {
      // deletion functionalities
      items.push({
        id: 'delete',
        label: (
          <div
            className={twMerge(
              'flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100',
              !isRemovable && 'text-opactiy-50 hover:cursor-not-allowed'
            )}
          >
            <FontAwesomeIcon icon={faTrashCan} className="mr-2.5 h-4 w-4" />
            {t('manage.resources.deleteCollection')}
            {!isRemovable && <DeletionTooltip />}
          </div>
        ),
        onClick: () => setDeletionModal(true),
        disabled: !isRemovable,
        data: { cy: 'delete-answer-collection' },
      })
    }

    return items
  }, [
    t,
    isOwner,
    isManager,
    isEditor,
    isRemovable,
    setSharingModal,
    setEditModal,
    setViewingModal,
    setRemovalModal,
    setDeletionModal,
  ])
}

export default useAnswerCollectionActionsDropdown
