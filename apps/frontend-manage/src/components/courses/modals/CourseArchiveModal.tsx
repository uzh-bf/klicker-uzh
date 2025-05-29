import { useMutation } from '@apollo/client'
import {
  GetUserCoursesDocument,
  ToggleArchiveCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, ModalLegacy, UserNotification } from '@uzh-bf/design-system'
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
    <ModalLegacy
      open={open}
      onClose={() => {
        setOpen(false)
      }}
      className={{ content: 'max-w-[30rem]' }}
      title={
        isArchived
          ? t('manage.courseList.unarchiveCourse')
          : t('manage.courseList.archiveCourse')
      }
      onPrimaryAction={
        <Button
          primary
          loading={loading}
          onClick={async () => {
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
          data={{ cy: 'course-archive-modal-confirm' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => {
            setOpen(false)
          }}
          data={{ cy: 'course-archive-modal-cancel' }}
        >
          <Button.Label>{t('shared.generic.close')}</Button.Label>
        </Button>
      }
    >
      <UserNotification
        type="warning"
        message={
          !isArchived
            ? t('manage.courseList.confirmCourseArchive')
            : t('manage.courseList.confirmCourseUnarchive')
        }
      />
    </ModalLegacy>
  )
}

export default CourseArchiveModal
