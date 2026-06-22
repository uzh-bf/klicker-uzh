import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function CourseRemovalModal({
  courseId,
  title,
  isModalOpen,
  setModalOpen,
}: {
  courseId: string
  title: string
  isModalOpen: boolean
  setModalOpen: (newOpen: boolean) => void
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const removeObject = trpc.sharing.removeObject.useMutation()
  const [confirmations, setConfirmations] = useState({
    actionFinal: false, // action cannot be undone, course will remain accessible to students
    dependencyAccess: false, // access to dependencies might be lost if only granted through derived rights
  })

  // on modal opening, reset the confirmation state
  useEffect(() => {
    if (isModalOpen) {
      setConfirmations({
        actionFinal: false,
        dependencyAccess: false,
      })
    }
  }, [isModalOpen])

  return (
    <ActivityConfirmationModal
      onClose={() => setModalOpen(false)}
      title={t('manage.course.removeCourse')}
      message={t.rich('manage.course.confirmCourseRemoval', {
        name: title,
        b: (content) => <b>{content}</b>,
      })}
      onSubmit={async () => {
        const result = await removeObject.mutateAsync({
          objectId: courseId,
          objectType: 'COURSE',
        })
        if (!result.removedObjectId) {
          throw new Error('Failed to remove course')
        }

        utils.course.userCourses.setData(undefined, (data) =>
          data?.userCourses
            ? {
                userCourses: data.userCourses.filter(
                  (course) => course.id !== result.removedObjectId
                ),
              }
            : data
        )
        void utils.course.userCourses.invalidate().catch(console.error)
      }}
      submitting={removeObject.isLoading}
      confirmations={confirmations}
      confirmationsInitializing={false}
      confirmationType="delete"
    >
      <div className="flex flex-col gap-2">
        <ConfirmationItem
          confirmationType="delete"
          label={t('manage.course.courseRemovalFinal')}
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
          label={t('manage.course.courseRemovalDependencyAccess')}
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

export default CourseRemovalModal
