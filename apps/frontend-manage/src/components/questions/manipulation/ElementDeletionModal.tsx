import { useMutation } from '@apollo/client'
import {
  DeleteElementDocument,
  GetUserElementsDocument,
  GetUserTagsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from '../../courses/modals/ActivityConfirmationModal'

function ElementDeletionModal({
  elementId,
  title,
  isModalOpen,
  setModalOpen,
  unsetDeletedQuestion,
}: {
  elementId: number
  title: string
  isModalOpen: boolean
  setModalOpen: Dispatch<SetStateAction<boolean>>
  unsetDeletedQuestion: (questionId: number) => void
}) {
  const t = useTranslations()
  const [confirmations, setConfirmations] = useState({
    actionFinal: false, // action cannot be undone, element will not be removed from any created activities
    otherUsersAccess: false, // other users might not lose access to the element, if used
    derivedAccessHint: false, // derived access might be granted if element is still used
    dependencyAccess: false, // access to dependencies might be lost if only granted through derived rights
  })

  const [deleteElement, { loading: deleting }] = useMutation(
    DeleteElementDocument
  )

  // on modal opening, reset the confirmation state
  useEffect(() => {
    if (isModalOpen) {
      setConfirmations({
        actionFinal: false,
        otherUsersAccess: false,
        derivedAccessHint: false,
        dependencyAccess: false,
      })
    }
  }, [isModalOpen])

  return (
    <ActivityConfirmationModal
      onClose={() => setModalOpen(false)}
      title={t('manage.questionPool.deleteElement')}
      message={t.rich('manage.questionPool.confirmDeletion', {
        name: title,
        b: (content) => <b>{content}</b>,
      })}
      onSubmit={async () => {
        await deleteElement({
          variables: {
            id: elementId,
          },
          refetchQueries: [
            { query: GetUserElementsDocument },
            { query: GetUserTagsDocument },
          ],
        })
        unsetDeletedQuestion(elementId)
        setModalOpen(false)
      }}
      submitting={deleting}
      confirmations={confirmations}
      confirmationsInitializing={false}
      confirmationType="delete"
    >
      <div className="flex flex-col gap-2">
        <ConfirmationItem
          confirmationType="delete"
          label={t('manage.questionPool.elementDeletionFinal')}
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              actionFinal: true,
            }))
          }}
          confirmed={confirmations.actionFinal}
          notApplicable={false}
          data={{ cy: 'confirm-deletion-final' }}
        />
        <ConfirmationItem
          confirmationType="delete"
          label={t('manage.questionPool.elementDeletionOtherUsers')}
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              otherUsersAccess: true,
            }))
          }}
          confirmed={confirmations.otherUsersAccess}
          notApplicable={false}
          data={{ cy: 'confirm-other-users-access' }}
        />
        <ConfirmationItem
          confirmationType="delete"
          label={t('manage.questionPool.elementDeletionDerivedAccessHint')}
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              derivedAccessHint: true,
            }))
          }}
          confirmed={confirmations.derivedAccessHint}
          notApplicable={false}
          data={{ cy: 'confirm-derived-access' }}
        />
        <ConfirmationItem
          confirmationType="delete"
          label={t('manage.questionPool.elementDeletionDependencyAccess')}
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              dependencyAccess: true,
            }))
          }}
          confirmed={confirmations.dependencyAccess}
          notApplicable={false}
          data={{ cy: 'confirm-dependency-access' }}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default ElementDeletionModal
