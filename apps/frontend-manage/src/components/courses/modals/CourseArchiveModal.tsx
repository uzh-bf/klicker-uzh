import { useMutation } from '@apollo/client'
import { ToggleArchiveCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
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
    ToggleArchiveCourseDocument
  )

  if (!courseId) {
    return null
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      className={{ content: 'h-max min-h-max max-w-[30rem]' }}
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
          }}
          className={{ root: 'bg-primary-100 text-white' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button onClick={() => setOpen(false)}>
          {t('shared.generic.close')}
        </Button>
      }
    >
      <UserNotification
        type="info"
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
