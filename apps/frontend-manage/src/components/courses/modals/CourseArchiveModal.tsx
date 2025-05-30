import { useMutation } from '@apollo/client'
import {
  GetUserCoursesDocument,
  ToggleArchiveCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CourseArchiveModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  courseId: string | null
  isArchived: boolean
}

function CourseArchiveModal({
  open,
  setOpen,
  courseId,
  isArchived,
}: CourseArchiveModalProps) {
  const t = useTranslations()
  const [toggleArchiveCourse, { loading }] = useMutation(
    ToggleArchiveCourseDocument,
    { refetchQueries: [{ query: GetUserCoursesDocument }] }
  )

  if (!courseId) {
    return null
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false)
      }}
      title={
        isArchived
          ? t('manage.courseList.unarchiveCourse')
          : t('manage.courseList.archiveCourse')
      }
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={loading}
      onPrimaryAction={async () => {
        await toggleArchiveCourse({
          variables: { id: courseId, isArchived: !isArchived },
          optimisticResponse: {
            __typename: 'Mutation',
            toggleArchiveCourse: {
              __typename: 'Course',
              id: courseId,
              isArchived: !isArchived,
            },
          },
        })
        setOpen(false)
      }}
      dataPrimaryAction={{ cy: 'course-archive-modal-confirm' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => {
        setOpen(false)
      }}
      dataSecondaryAction={{ cy: 'course-archive-modal-cancel' }}
      className={{ content: 'max-w-[30rem]' }}
    >
      <UserNotification
        type="warning"
        message={
          !isArchived
            ? t('manage.courseList.confirmCourseArchive')
            : t('manage.courseList.confirmCourseUnarchive')
        }
      />
    </Modal>
  )
}

export default CourseArchiveModal
