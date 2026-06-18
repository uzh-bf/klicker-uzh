import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

function CourseArchiveModal({
  onClose,
  courseId,
  isArchived,
}: {
  onClose: () => void
  courseId: string | null
  isArchived: boolean
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const toggleArchiveCourse = trpc.course.toggleArchive.useMutation()

  if (!courseId) {
    return null
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        isArchived
          ? t('manage.courseList.unarchiveCourse')
          : t('manage.courseList.archiveCourse')
      }
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={toggleArchiveCourse.isLoading}
      onPrimaryAction={async () => {
        await toggleArchiveCourse.mutateAsync({
          id: courseId,
          isArchived: !isArchived,
        })
        await utils.course.userCourses.invalidate()
        onClose()
      }}
      dataPrimaryAction={{ cy: 'course-archive-modal-confirm' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'course-archive-modal-cancel' }}
      className={{ content: 'max-w-120' }}
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
