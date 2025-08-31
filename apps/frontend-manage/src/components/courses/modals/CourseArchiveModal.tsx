import { useMutation } from '@apollo/client'
import { ToggleArchiveCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

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
  const [toggleArchiveCourse, { loading }] = useMutation(
    ToggleArchiveCourseDocument
  )

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
          update: (cache, { data }) => {
            // check if the query was successful
            if (!data?.toggleArchiveCourse) return

            // update the entry in the course list accordingly
            cache.modify({
              id: cache.identify(data.toggleArchiveCourse),
              fields: {
                isArchived: () => data.toggleArchiveCourse!.isArchived,
              },
            })
          },
        })
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
