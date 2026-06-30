import { Modal, UserNotification, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
  const [archivePending, setArchivePending] = useState(false)
  const toggleArchiveCourse = trpc.course.toggleArchive.useMutation()
  const archiving = toggleArchiveCourse.isLoading || archivePending
  const handleClose = () => {
    if (!archiving) {
      onClose()
    }
  }

  if (!courseId) {
    return null
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={
        isArchived
          ? t('manage.courseList.unarchiveCourse')
          : t('manage.courseList.archiveCourse')
      }
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={archiving}
      primaryDisabled={archiving}
      onPrimaryAction={async () => {
        if (archiving) return
        setArchivePending(true)

        try {
          const result = await toggleArchiveCourse.mutateAsync({
            id: courseId,
            isArchived: !isArchived,
          })

          if (!result.course?.id) {
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
            setArchivePending(false)
            return
          }

          utils.course.userCourses.setData(undefined, (data) =>
            data?.userCourses
              ? {
                  userCourses: data.userCourses
                    .map((course) =>
                      course.id === result.course?.id
                        ? { ...course, isArchived: result.course.isArchived }
                        : course
                    )
                    .sort((a, b) =>
                      a.isArchived === b.isArchived ? 0 : a.isArchived ? 1 : -1
                    ),
                }
              : data
          )
          await utils.course.userCourses.invalidate().catch(console.error)
          onClose()
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
          setArchivePending(false)
        }
      }}
      dataPrimaryAction={{ cy: 'course-archive-modal-confirm' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={handleClose}
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
