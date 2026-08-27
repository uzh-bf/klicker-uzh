import { useQuery } from '@apollo/client'
import { GetCourseDeletionSummaryDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useCourseDeletionStatus } from '../CourseDeletionStatusProvider'
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

const initialConfirmations: CourseDeletionConfirmationType = {
  deleteParticipations: false,
  disconnectLiveQuizzes: false,
  deletePracticeQuizzes: false,
  deleteMicroLearnings: false,
  deleteGroupActivities: false,
  deleteParticipantGroups: false,
  deleteLeaderboardEntries: false,
}

function CourseDeletionModal({
  onClose,
  courseId,
}: {
  onClose: () => void
  courseId: string | null
}) {
  const [confirmations, setConfirmations] =
    useState<CourseDeletionConfirmationType>({
      ...initialConfirmations,
    })
  const [deleteDraftActivities, setDeleteDraftActivities] = useState(false)
  const [deletionStarting, setDeletionStarting] = useState(false)
  const t = useTranslations()
  const { startCourseDeletion } = useCourseDeletionStatus()

  // fetch course information
  const { data, loading: queryLoading } = useQuery(
    GetCourseDeletionSummaryDocument,
    {
      variables: { courseId: courseId ?? '' },
      skip: !courseId,
    }
  )

  const closeModal = () => {
    onClose()
    setConfirmations({ ...initialConfirmations })
    setDeleteDraftActivities(false)
  }

  // skip confirmation for the elements where none are present
  useEffect(() => {
    if (!courseId || !data?.getCourseSummary) {
      return
    }

    setConfirmations({
      deleteParticipations: data.getCourseSummary.numOfParticipations === 0,
      disconnectLiveQuizzes: data.getCourseSummary.numOfLiveQuizzes === 0,
      deletePracticeQuizzes: data.getCourseSummary.numOfPracticeQuizzes === 0,
      deleteMicroLearnings: data.getCourseSummary.numOfMicroLearnings === 0,
      deleteGroupActivities: data.getCourseSummary.numOfGroupActivities === 0,
      deleteParticipantGroups:
        data.getCourseSummary.numOfParticipantGroups === 0,
      deleteLeaderboardEntries:
        data.getCourseSummary.numOfLeaderboardEntries === 0,
    })
  }, [courseId, data?.getCourseSummary])

  const summary = data?.getCourseSummary
  if (!courseId) {
    return null
  }

  return (
    <Modal
      open
      loading={queryLoading || !summary}
      onClose={closeModal}
      className={{ content: 'w-full! max-w-240' }}
      title={t('manage.courseList.deleteCourse')}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={deletionStarting}
      primaryDisabled={
        queryLoading ||
        Object.values(confirmations).some((confirmation) => !confirmation)
      }
      onPrimaryAction={async () => {
        setDeletionStarting(true)
        let started = false
        try {
          started = await startCourseDeletion({
            courseId,
            deleteDraftActivities,
          })
        } finally {
          setDeletionStarting(false)
        }
        if (started) closeModal()
      }}
      dataPrimaryAction={{ cy: 'course-deletion-modal-confirm' }}
      secondaryLabel={t('shared.generic.close')}
      onSecondaryAction={closeModal}
      dataSecondaryAction={{ cy: 'course-deletion-modal-cancel' }}
    >
      {summary && (
        <CourseDeletionConfirmations
          summary={summary}
          confirmations={confirmations}
          setConfirmations={setConfirmations}
          deleteDraftActivities={deleteDraftActivities}
          setDeleteDraftActivities={setDeleteDraftActivities}
        />
      )}
    </Modal>
  )
}

export default CourseDeletionModal
