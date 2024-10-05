import { useMutation } from '@apollo/client'
import {
  DeletePracticeQuizDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ActivityDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  title: string
  message: string
  activityId: string
  activityType: 'PracticeQuiz' | 'MicroLearning' | 'GroupActivity'
  courseId: string
  confirmations: Record<string, boolean>
  confirmationsInitializing: boolean
  children: React.ReactNode
}

function ActivityDeletionModal({
  open,
  setOpen,
  title,
  message,
  activityId,
  activityType,
  courseId,
  confirmations,
  confirmationsInitializing,
  children,
}: ActivityDeletionModalProps) {
  const t = useTranslations()

  const [deletePracticeQuiz, { loading: deletingPracticeQuiz }] = useMutation(
    DeletePracticeQuizDocument,
    {
      variables: { id: activityId! },
      optimisticResponse: {
        deletePracticeQuiz: {
          id: activityId,
          __typename: 'PracticeQuiz',
        },
      },
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId: courseId } },
      ],
    }
  )

  // TODO: set the following booleans once available
  const deletingMicroLearning = false
  const deletingGroupActivity = false

  // TODO: set the following mutations once available
  const deleteMicroLearning = async () => {}
  const deleteGroupActivity = async () => {}

  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false)
      }}
      className={{ content: '!w-full max-w-[50rem]' }}
      title={title}
      onPrimaryAction={
        <Button
          loading={
            deletingPracticeQuiz ||
            deletingMicroLearning ||
            deletingGroupActivity
          }
          disabled={
            confirmationsInitializing ||
            Object.values(confirmations).some((confirmation) => !confirmation)
          }
          onClick={async () => {
            if (activityType === 'PracticeQuiz') {
              await deletePracticeQuiz()
            } else if (activityType === 'MicroLearning') {
              await deleteMicroLearning()
            } else if (activityType === 'GroupActivity') {
              await deleteGroupActivity()
            }

            setOpen(false)
          }}
          className={{
            root: 'bg-red-700 text-white hover:bg-red-800 hover:text-white disabled:bg-opacity-50 disabled:hover:cursor-not-allowed',
          }}
          data={{ cy: 'activity-deletion-modal--confirm' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => {
            setOpen(false)
          }}
          data={{ cy: 'activity-deletion-modal-cancel' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
    >
      <UserNotification
        type="warning"
        message={message}
        className={{ root: 'mb-3' }}
      />
      {children}
    </Modal>
  )
}

export default ActivityDeletionModal
