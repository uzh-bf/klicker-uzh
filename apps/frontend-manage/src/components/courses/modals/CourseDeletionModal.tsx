import { useQuery } from '@apollo/client'
import { GetCourseDeletionSummaryV2Document } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useCourseDeletionStatus } from '../CourseDeletionStatusProvider'
import CourseDeletionConfirmations from './CourseDeletionConfirmations'

export interface CourseDeletionConfirmationType {
  participations: boolean
  liveQuizzes: boolean
  practiceQuizzes: boolean
  microLearnings: boolean
  groupActivities: boolean
  participantGroups: boolean
  leaderboardEntries: boolean
}

const initialConfirmations: CourseDeletionConfirmationType = {
  participations: false,
  liveQuizzes: false,
  practiceQuizzes: false,
  microLearnings: false,
  groupActivities: false,
  participantGroups: false,
  leaderboardEntries: false,
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
    GetCourseDeletionSummaryV2Document,
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

  useEffect(() => {
    if (!courseId || !data?.getCourseSummary) {
      return
    }

    setConfirmations({
      participations: data.getCourseSummary.numOfParticipations === 0,
      liveQuizzes: data.getCourseSummary.numOfLiveQuizzes === 0,
      practiceQuizzes: data.getCourseSummary.numOfPracticeQuizzes === 0,
      microLearnings: data.getCourseSummary.numOfMicroLearnings === 0,
      groupActivities: data.getCourseSummary.numOfGroupActivities === 0,
      participantGroups: data.getCourseSummary.numOfParticipantGroups === 0,
      leaderboardEntries: data.getCourseSummary.numOfLeaderboardEntries === 0,
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
        !summary ||
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
