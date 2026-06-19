import { faCopy, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faComment,
  faPencil,
  faShare,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo } from 'react'
import type { Element } from '../../lib/constants/elementTypes'
import { ActivityAction } from '../activities/actions/useAvailableActions'

function useElementActions({
  element,
  disabled,
  setShowRecoveryPrompt,
  setModificationModalOpen,
  setDuplicationModalOpen,
  setDeletionModalOpen,
  setRemovalModalOpen,
  setActivityLogOpen,
  setSharingModalOpen,
}: {
  element: Element
  disabled: boolean
  setShowRecoveryPrompt: Dispatch<SetStateAction<boolean>>
  setModificationModalOpen: Dispatch<SetStateAction<boolean>>
  setDuplicationModalOpen: Dispatch<SetStateAction<boolean>>
  setDeletionModalOpen: Dispatch<SetStateAction<boolean>>
  setRemovalModalOpen: Dispatch<SetStateAction<boolean>>
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
  setSharingModalOpen: Dispatch<SetStateAction<boolean>>
}): ActivityAction[] {
  const t = useTranslations()

  const actions = useMemo(
    () => [
      {
        id: 'editElement',
        label: t('manage.elements.EDITTitle'),
        icon: faPencil,
        onClick: async () => {
          const value = localStorage.getItem(`autosave-element-${element.id}`)

          if (value) {
            setShowRecoveryPrompt(true)
          } else {
            setModificationModalOpen(true)
          }
        },
        disabled,
        data: { cy: `edit-element-${element.name}` },
      },
      {
        id: 'duplicateElement',
        label: t('manage.elements.DUPLICATETitle'),
        icon: faCopy,
        onClick: () => setDuplicationModalOpen(true),
        disabled,
        data: { cy: `duplicate-element-${element.name}` },
      },
      {
        id: 'activityLog',
        label: t('shared.comments.viewComments'),
        icon: faComment,
        onClick: () => setActivityLogOpen(true),
        disabled,
        data: { cy: `view-activity-log-${element.name}` },
      },
      {
        id: 'shareElement',
        label: t('manage.elements.shareElement'),
        icon: faShare,
        onClick: () => setSharingModalOpen(true),
        disabled,
        data: { cy: `share-element-${element.name}` },
      },
      {
        id: 'removeElement',
        label: t('manage.questionPool.removeElement'),
        icon: faX,
        onClick: () => setRemovalModalOpen(true),
        disabled,
        className: 'text-red-600 hover:text-red-600',
        data: { cy: `remove-element-${element.name}` },
      },
      {
        id: 'deleteElement',
        label: t('manage.questionPool.deleteElement'),
        icon: faTrashCan,
        onClick: () => setDeletionModalOpen(true),
        disabled,
        className: 'text-red-600 hover:text-red-600',
        data: { cy: `delete-element-${element.name}` },
      },
    ],
    [
      t,
      element,
      disabled,
      setShowRecoveryPrompt,
      setModificationModalOpen,
      setDuplicationModalOpen,
      setDeletionModalOpen,
      setRemovalModalOpen,
      setActivityLogOpen,
      setSharingModalOpen,
    ]
  )

  return actions
}

export default useElementActions
