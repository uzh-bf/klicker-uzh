import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from '../../courses/modals/ActivityConfirmationModal'

function ElementRemovalModal({
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
  const removeObject = trpc.sharing.removeObject.useMutation()
  const [confirmations, setConfirmations] = useState({
    actionFinal: false, // action cannot be undone, element will not be removed from any created activities
    derivedAccessHint: false, // derived access might be granted if element is still used
    dependencyAccess: false, // access to dependencies might be lost if only granted through derived rights
  })

  // fetch element information
  const {
    data,
    error: summaryError,
    isLoading: queryLoading,
  } = trpc.element.summary.useQuery({ id: elementId }, { enabled: !!elementId })
  const summary = data?.elementSummary
  const initialSummaryLoading = queryLoading && !summary
  const summaryUnavailable = Boolean(
    (summaryError || !queryLoading) && !summary
  )

  const notApplicableDerived = !!summary && !summary.retainsDerivedAccess
  const notApplicableResources = !!summary && !summary.derivedAccessToResources

  // on modal opening, reset the confirmation state
  useEffect(() => {
    if (isModalOpen) {
      setConfirmations({
        actionFinal: false,
        derivedAccessHint: notApplicableDerived,
        dependencyAccess: notApplicableResources,
      })
    }
  }, [isModalOpen, notApplicableDerived, notApplicableResources])

  return (
    <ActivityConfirmationModal
      onClose={() => setModalOpen(false)}
      title={t('manage.questionPool.removeElement')}
      loading={initialSummaryLoading}
      message={t.rich('manage.questionPool.confirmElementRemoval', {
        name: title,
        b: (content) => <b>{content}</b>,
      })}
      onSubmit={async () => {
        await removeObject.mutateAsync({
          objectId: String(elementId),
          objectType: 'ELEMENT',
        })
        void refetchElements().catch(console.error)
      }}
      submitting={removeObject.isLoading}
      confirmations={summary ? confirmations : { summaryLoaded: false }}
      confirmationsInitializing={initialSummaryLoading}
      confirmationType="delete"
    >
      {summaryUnavailable ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}

      {summary ? (
        <div className="flex flex-col gap-2">
          <ConfirmationItem
            confirmationType="delete"
            label={t('manage.questionPool.elementRemovalFinal')}
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
              notApplicableDerived
                ? t(
                    'manage.questionPool.elementRemovalDerivedAccessHintNotApplicable'
                  )
                : t('manage.questionPool.elementRemovalDerivedAccessHint')
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
                    'manage.questionPool.elementDeletionDerivedAccessNotApplicable'
                  )
                : t('manage.questionPool.elementDeletionDerivedAccessHint')
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
      ) : null}
    </ActivityConfirmationModal>
  )
}

export default ElementRemovalModal
