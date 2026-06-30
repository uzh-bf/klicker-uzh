import { Modal, UserNotification, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import CourseDeletionConfirmations from './CourseDeletionConfirmations'

export interface CourseDeletionConfirmationType {
  deleteParticipations: boolean
  disconnectLiveQuizzes: boolean
  deletePracticeQuizzes: boolean
  deleteMicroLearnings: boolean
  deleteGroupActivities: boolean
  deleteParticipantGroups: boolean
  deleteLeaderboardEntries: boolean
}

function CourseDeletionModal({
  onClose,
  courseId,
}: {
  onClose: () => void
  courseId: string | null
}) {
  const initialConfirmations: CourseDeletionConfirmationType = {
    deleteParticipations: false,
    disconnectLiveQuizzes: false,
    deletePracticeQuizzes: false,
    deleteMicroLearnings: false,
    deleteGroupActivities: false,
    deleteParticipantGroups: false,
    deleteLeaderboardEntries: false,
  }

  const [confirmations, setConfirmations] =
    useState<CourseDeletionConfirmationType>({
      ...initialConfirmations,
    })
  const t = useTranslations()
  const utils = trpc.useUtils()

  // fetch course information
  const {
    data,
    error: summaryError,
    isLoading: queryLoading,
  } = trpc.course.summary.useQuery(
    { courseId: courseId ?? '' },
    { enabled: Boolean(courseId) }
  )

  const deleteCourse = trpc.course.delete.useMutation()
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const deleting = deleteCourse.isLoading || deleteSubmitting

  // skip confirmation for the elements where none are present
  useEffect(() => {
    if (!courseId || !data?.courseSummary) {
      return
    }

    setConfirmations({
      deleteParticipations: data.courseSummary.numOfParticipations === 0,
      disconnectLiveQuizzes: data.courseSummary.numOfLiveQuizzes === 0,
      deletePracticeQuizzes: data.courseSummary.numOfPracticeQuizzes === 0,
      deleteMicroLearnings: data.courseSummary.numOfMicroLearnings === 0,
      deleteGroupActivities: data.courseSummary.numOfGroupActivities === 0,
      deleteParticipantGroups: data.courseSummary.numOfParticipantGroups === 0,
      deleteLeaderboardEntries:
        data.courseSummary.numOfLeaderboardEntries === 0,
    })
  }, [courseId, data?.courseSummary])

  const summary = data?.courseSummary
  const initialSummaryLoading = queryLoading && !summary
  const summaryUnavailable = Boolean(
    (summaryError || !queryLoading) && !summary
  )
  const closeModal = () => {
    onClose()
    setConfirmations({ ...initialConfirmations })
  }
  const handleClose = () => {
    if (!deleting) {
      closeModal()
    }
  }
  if (!courseId) {
    return null
  }

  return (
    <Modal
      open
      loading={initialSummaryLoading}
      onClose={handleClose}
      className={{ content: 'w-full! max-w-240' }}
      title={t('manage.courseList.deleteCourse')}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={deleting}
      primaryDisabled={
        deleting ||
        initialSummaryLoading ||
        summaryUnavailable ||
        Object.values(confirmations).some((confirmation) => !confirmation)
      }
      onPrimaryAction={async () => {
        setDeleteSubmitting(true)
        try {
          const result = await deleteCourse.mutateAsync({ id: courseId })

          if (!result.course?.id) {
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
            return
          }

          utils.course.userCourses.setData(undefined, (data) =>
            data?.userCourses
              ? {
                  userCourses: data.userCourses.filter(
                    (course) => course.id !== result.course?.id
                  ),
                }
              : data
          )
          await utils.course.userCourses.invalidate().catch(console.error)
          closeModal()
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
        } finally {
          setDeleteSubmitting(false)
        }
      }}
      dataPrimaryAction={{ cy: 'course-deletion-modal-confirm' }}
      secondaryLabel={t('shared.generic.close')}
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'course-deletion-modal-cancel' }}
    >
      {summaryUnavailable ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}

      {summary ? (
        <CourseDeletionConfirmations
          summary={summary}
          confirmations={confirmations}
          setConfirmations={setConfirmations}
        />
      ) : null}
    </Modal>
  )
}

export default CourseDeletionModal
