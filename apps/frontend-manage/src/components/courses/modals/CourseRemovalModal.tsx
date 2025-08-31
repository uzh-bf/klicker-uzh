import { useMutation } from '@apollo/client'
import {
  GetUserCoursesDocument,
  ObjectType,
  RemoveObjectDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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
  const [confirmations, setConfirmations] = useState({
    actionFinal: false, // action cannot be undone, course will remain accessible to students
    dependencyAccess: false, // access to dependencies might be lost if only granted through derived rights
  })

  const [removeObject, { loading: removing }] =
    useMutation(RemoveObjectDocument)

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
        await removeObject({
          variables: {
            objectId: courseId,
            objectType: ObjectType.Course,
          },
          update: (cache, { data }) => {
            // check if the removal was successful
            if (!data?.removeObject) return

            // remove the course from the queries list
            cache.updateQuery({ query: GetUserCoursesDocument }, (qData) => ({
              userCourses: qData?.userCourses?.filter(
                (course) => course.id !== data.removeObject!
              ),
            }))
          },
        })
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
