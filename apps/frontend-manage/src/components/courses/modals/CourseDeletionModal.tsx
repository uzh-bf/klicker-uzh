import { Modal } from '@uzh-bf/design-system'
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
  const { data, isLoading: queryLoading } = trpc.course.summary.useQuery(
    { courseId: courseId ?? '' },
    { enabled: Boolean(courseId) }
  )

  const deleteCourse = trpc.course.delete.useMutation()

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
  if (!courseId) {
    return null
  }

  return (
    <Modal
      open
      loading={queryLoading || !summary}
      onClose={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      className={{ content: 'w-full! max-w-240' }}
      title={t('manage.courseList.deleteCourse')}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={deleteCourse.isLoading}
      primaryDisabled={
        queryLoading ||
        Object.values(confirmations).some((confirmation) => !confirmation)
      }
      onPrimaryAction={async () => {
        await deleteCourse.mutateAsync({ id: courseId })
        await utils.course.userCourses.invalidate()
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      dataPrimaryAction={{ cy: 'course-deletion-modal-confirm' }}
      secondaryLabel={t('shared.generic.close')}
      onSecondaryAction={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      dataSecondaryAction={{ cy: 'course-deletion-modal-cancel' }}
    >
      {summary && (
        <CourseDeletionConfirmations
          summary={summary}
          confirmations={confirmations}
          setConfirmations={setConfirmations}
        />
      )}
    </Modal>
  )
}

export default CourseDeletionModal
