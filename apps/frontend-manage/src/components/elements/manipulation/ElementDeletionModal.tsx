import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteElementDocument,
  GetElementSummaryDocument,
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
  refetchElements,
}: {
  elementId: number
  title: string
  isModalOpen: boolean
  setModalOpen: Dispatch<SetStateAction<boolean>>
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations()
  const [confirmations, setConfirmations] = useState({
    actionFinal: false, // action cannot be undone, element will not be removed from any created activities
    otherUsersAccess: false, // other users might not lose access to the element, if used
    derivedAccessHint: false, // derived access might be granted if element is still used
    dependencyAccess: false, // access to dependencies might be lost if only granted through derived rights
  })

  // fetch element information
  const { data, loading: queryLoading } = useQuery(GetElementSummaryDocument, {
    variables: { id: elementId },
    skip: !elementId,
    fetchPolicy: 'network-only',
  })

  // deletion mutation
  // TODO: add query update
  const [deleteElement, { loading: deleting }] = useMutation(
    DeleteElementDocument
  )

  const notApplicableShared =
    !!data?.getElementSummary &&
    !data.getElementSummary.sharedElementActivityUse
  const notApplicableDerived =
    !!data?.getElementSummary && !data.getElementSummary.retainsDerivedAccess
  const notApplicableResources =
    !!data?.getElementSummary &&
    !data.getElementSummary.derivedAccessToResources

  // on modal opening, reset the confirmation state
  useEffect(() => {
    if (isModalOpen) {
      setConfirmations({
        actionFinal: false,
        otherUsersAccess: notApplicableShared,
        derivedAccessHint: notApplicableDerived,
        dependencyAccess: notApplicableResources,
      })
    }
  }, [
    isModalOpen,
    notApplicableDerived,
    notApplicableResources,
    notApplicableShared,
  ])

  return (
    <ActivityConfirmationModal
      onClose={() => setModalOpen(false)}
      title={t('manage.questionPool.deleteElement')}
      loading={queryLoading}
      message={t.rich('manage.questionPool.confirmDeletion', {
        name: title,
        b: (content) => <b>{content}</b>,
      })}
      onSubmit={async () => {
        await deleteElement({
          variables: {
            id: elementId,
          },
          refetchQueries: [{ query: GetUserTagsDocument }],
        })
        await refetchElements()
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
          label={
            notApplicableShared
              ? t('manage.questionPool.elementDeletionOtherUsersNotApplicable')
              : t('manage.questionPool.elementDeletionOtherUsers')
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              otherUsersAccess: true,
            }))
          }}
          confirmed={confirmations.otherUsersAccess}
          notApplicable={notApplicableShared}
          data={{ cy: 'confirm-other-users-access' }}
        />
        <ConfirmationItem
          confirmationType="delete"
          label={
            notApplicableDerived
              ? t(
                  'manage.questionPool.elementDeletionDerivedAccessNotApplicable'
                )
              : t('manage.questionPool.elementDeletionDerivedAccessHint')
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              derivedAccessHint: true,
            }))
          }}
          confirmed={confirmations.derivedAccessHint}
          notApplicable={notApplicableDerived}
          data={{ cy: 'confirm-derived-access' }}
        />
        <ConfirmationItem
          confirmationType="delete"
          label={
            notApplicableResources
              ? t(
                  'manage.questionPool.elementDeletionDependencyAccessNotApplicable'
                )
              : t('manage.questionPool.elementDeletionDependencyAccess')
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              dependencyAccess: true,
            }))
          }}
          confirmed={confirmations.dependencyAccess}
          notApplicable={notApplicableResources}
          data={{ cy: 'confirm-dependency-access' }}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default ElementDeletionModal
