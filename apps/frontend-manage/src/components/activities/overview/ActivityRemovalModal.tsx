import { useMutation } from '@apollo/client'
import {
  ActivityType,
  ObjectType,
  RemoveObjectDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from '../../courses/modals/ActivityConfirmationModal'

function ActivityRemovalModal({
  activityId,
  activityType,
  title,
  isModalOpen,
  setModalOpen,
  refetchActivities,
}: {
  activityId: string
  activityType: ActivityType
  title: string
  isModalOpen: boolean
  setModalOpen: Dispatch<SetStateAction<boolean>>
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const [confirmations, setConfirmations] = useState({
    actionFinal: false, // action cannot be undone, activity will remain accessible to students / assigned to courses
    derivedAccessHint: false, // derived access might be granted if element is still used
    dependencyAccess: false, // access to dependencies might be lost if only granted through derived rights
  })

  // TODO: add query update
  const [removeObject, { loading: removing }] =
    useMutation(RemoveObjectDocument)

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
      title={t('manage.activities.removeActivity')}
      message={t.rich('manage.activities.confirmActivityRemoval', {
        name: title,
        b: (content) => <b>{content}</b>,
      })}
      onSubmit={async () => {
        if (activityType === ActivityType.LiveQuiz) {
          await removeObject({
            variables: {
              objectId: activityId,
              objectType: ObjectType.LiveQuiz,
            },
          })
          await refetchActivities?.()
        } else if (activityType === ActivityType.PracticeQuiz) {
          await removeObject({
            variables: {
              objectId: activityId,
              objectType: ObjectType.PracticeQuiz,
            },
          })
          await refetchActivities?.()
        } else if (activityType === ActivityType.MicroLearning) {
          await removeObject({
            variables: {
              objectId: activityId,
              objectType: ObjectType.MicroLearning,
            },
          })
          await refetchActivities?.()
        } else if (activityType === ActivityType.GroupActivity) {
          await removeObject({
            variables: {
              objectId: activityId,
              objectType: ObjectType.GroupActivity,
            },
          })
          await refetchActivities?.()
        }
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
          label={t('manage.activities.activityRemovalFinal')}
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
          label={t('manage.activities.activityRemovalDerivedAccessHint')}
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
          label={t('manage.activities.activityRemovalDependencyAccess')}
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

export default ActivityRemovalModal
