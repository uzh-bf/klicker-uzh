import { useMutation } from '@apollo/client'
import {
  GetUserElementsDocument,
  ObjectType,
  RemoveObjectDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from '../../courses/modals/ActivityConfirmationModal'

function ElementRemovalModal({
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
    derivedAccessHint: false, // derived access might be granted if element is still used
    dependencyAccess: false, // access to dependencies might be lost if only granted through derived rights
  })

  const [removeObject, { loading: removing }] = useMutation(
    RemoveObjectDocument,
    {
      variables: {
        objectId: String(elementId),
        objectType: ObjectType.Element,
      },
    }
  )

  // on modal opening, reset the confirmation state
  useEffect(() => {
    if (isModalOpen) {
      setConfirmations({
        actionFinal: false,
        derivedAccessHint: false,
        dependencyAccess: false,
      })
    }
  }, [isModalOpen])

  return (
    <ActivityConfirmationModal
      onClose={() => setModalOpen(false)}
      title={t('manage.questionPool.removeElement')}
      message={t.rich('manage.questionPool.confirmElementRemoval', {
        name: title,
        b: (content) => <b>{content}</b>,
      })}
      onSubmit={async () => {
        await removeObject({
          variables: {
            objectId: String(elementId),
            objectType: ObjectType.Element,
          },
          refetchQueries: [{ query: GetUserElementsDocument }],
        })
        unsetDeletedQuestion(elementId)
        setModalOpen(false)
      }}
      submitting={removing}
      confirmations={confirmations}
      confirmationsInitializing={false}
      confirmationType="delete"
    >
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
          label={t('manage.questionPool.elementRemovalDerivedAccessHint')}
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
          label={t('manage.questionPool.elementRemovalDependencyAccess')}
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

export default ElementRemovalModal
