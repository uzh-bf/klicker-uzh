import { useMutation } from '@apollo/client'
import {
  GetUserCoursesDocument,
  ToggleArchiveCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CourseArchiveModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  courseId: string | null
  setSelectedCourseId: (courseId: string | null) => void
  isArchived: boolean
}

function CourseArchiveModal({
  open,
  setOpen,
  courseId,
  setSelectedCourseId,
  isArchived,
}: CourseArchiveModalProps) {
  const t = useTranslations()
  const [toggleArchiveCourse, { loading }] = useMutation(
    ToggleArchiveCourseDocument,
    { refetchQueries: [GetUserCoursesDocument] }
  )

  if (!courseId) {
    return null
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false)
        setSelectedCourseId(null)
      }}
      className={{ content: 'max-w-[30rem]' }}
      title={
        isArchived
          ? t('manage.courseList.unarchiveCourse')
          : t('manage.courseList.archiveCourse')
      }
      onPrimaryAction={
        <Button
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
            setSelectedCourseId(null)
          }}
          className={{ root: 'bg-primary-100 text-white' }}
          data={{ cy: 'course-archive-modal-confirm' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => {
            setOpen(false)
            setSelectedCourseId(null)
          }}
          data={{ cy: 'course-archive-modal-cancel' }}
        >
          {t('shared.generic.close')}
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
    </Modal>
  )
}

export default CourseArchiveModal
