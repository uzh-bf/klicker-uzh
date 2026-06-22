import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { ActivityType } from '../../../lib/constants/activityEnums'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from '../../courses/modals/ActivityConfirmationModal'

function getRemovalObjectType(activityType: ActivityType) {
  if (activityType === ActivityType.LiveQuiz) return 'LIVE_QUIZ'
  if (activityType === ActivityType.PracticeQuiz) return 'PRACTICE_QUIZ'
  if (activityType === ActivityType.MicroLearning) return 'MICRO_LEARNING'
  if (activityType === ActivityType.GroupActivity) return 'GROUP_ACTIVITY'
  return null
}

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
  const removeObject = trpc.sharing.removeObject.useMutation()
  const [confirmations, setConfirmations] = useState({
    actionFinal: false, // action cannot be undone, activity will remain accessible to students / assigned to courses
    derivedAccessHint: false, // derived access might be granted if element is still used
    dependencyAccess: false, // access to dependencies might be lost if only granted through derived rights
  })

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
        const objectType = getRemovalObjectType(activityType)

        if (!objectType) {
          throw new Error('Unsupported activity type')
        }

        const result = await removeObject.mutateAsync({
          objectId: activityId,
          objectType,
        })

        if (!result.removedObjectId) {
          throw new Error('Failed to remove activity')
        }

        await refetchActivities?.().catch(console.error)
      }}
      submitting={removeObject.isLoading}
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
