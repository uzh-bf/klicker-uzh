import { useMutation } from '@apollo/client'
import { faCopy, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArchive,
  faComment,
  faInbox,
  faPencil,
  faShare,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import {
  ApplyElementBatchOperationsDocument,
  type Element,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ActivityAction } from '../activities/actions/useAvailableActions'

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
  refetchElements,
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
  refetchElements: () => Promise<void>
}): ActivityAction[] {
  const t = useTranslations()
  const isArchived = element.isArchived ?? false
  const [applyElementBatchOperations, { loading: updatingArchiveMutation }] =
    useMutation(ApplyElementBatchOperationsDocument)
  const [archiveStateBusy, setArchiveStateBusy] = useState(false)
  const archiveStateBusyRef = useRef(false)

  const updateArchiveState = useCallback(async () => {
    if (archiveStateBusyRef.current) return

    archiveStateBusyRef.current = true
    setArchiveStateBusy(true)

    try {
      let result: 'success' | 'failure' | 'uncertain'

      try {
        const { data } = await applyElementBatchOperations({
          variables: {
            elementIds: [element.id],
            archive: !isArchived,
            unarchive: isArchived,
            updateInstances: false,
            updateTemplateInstances: false,
          },
        })
        result = data?.applyElementBatchOperations === 1 ? 'success' : 'failure'
      } catch (error) {
        console.error(error)
        result = 'uncertain'
      }

      let refreshFailed = false
      try {
        await refetchElements()
      } catch (error) {
        console.error(error)
        refreshFailed = true
      }

      if (result === 'success' && !refreshFailed) {
        toast({
          type: 'success',
          message: isArchived
            ? t('manage.questionPool.elementRestoredSuccessfully')
            : t('manage.questionPool.elementArchivedSuccessfully'),
          options: { duration: 3000 },
        })
      } else if (result === 'success') {
        toast({
          type: 'warning',
          message: t('manage.questionPool.elementArchiveRefreshFailed'),
          options: { duration: 5000 },
        })
      } else if (result === 'uncertain') {
        toast({
          type: 'warning',
          message: t('manage.questionPool.elementArchiveActionUncertain'),
          options: { duration: 5000 },
        })
      } else {
        toast({
          type: 'error',
          message: t('manage.questionPool.elementArchiveActionFailed'),
          options: { duration: 5000 },
        })
      }
    } finally {
      archiveStateBusyRef.current = false
      setArchiveStateBusy(false)
    }
  }, [applyElementBatchOperations, element.id, isArchived, refetchElements, t])

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
      {
        id: 'archiveElement',
        label: isArchived
          ? t('manage.questionPool.restoreFromArchive')
          : t('manage.questionPool.moveToArchive'),
        icon: isArchived ? faInbox : faArchive,
        onClick: updateArchiveState,
        disabled: disabled || updatingArchiveMutation || archiveStateBusy,
        data: {
          cy: `${isArchived ? 'unarchive' : 'archive'}-element-${element.name}`,
        },
      },
    ],
    [
      t,
      element,
      isArchived,
      disabled,
      setShowRecoveryPrompt,
      setModificationModalOpen,
      setDuplicationModalOpen,
      setDeletionModalOpen,
      setRemovalModalOpen,
      setActivityLogOpen,
      setSharingModalOpen,
      updatingArchiveMutation,
      archiveStateBusy,
      updateArchiveState,
    ]
  )

  return actions
}

export default useElementActions
