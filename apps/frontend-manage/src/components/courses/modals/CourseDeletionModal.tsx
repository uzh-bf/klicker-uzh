import { useQuery } from '@apollo/client'
import { GetCourseDeletionSummaryV2Document } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useCourseDeletionStatus } from '../CourseDeletionStatusProvider'
import CourseDeletionConfirmations from './CourseDeletionConfirmations'

function CourseDeletionModal({
  onClose,
  courseId,
}: {
  onClose: () => void
  courseId: string | null
}) {
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
    setDeleteDraftActivities(false)
  }

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
      primaryDisabled={queryLoading || !summary}
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
          deleteDraftActivities={deleteDraftActivities}
          setDeleteDraftActivities={setDeleteDraftActivities}
        />
      )}
    </Modal>
  )
}

export default CourseDeletionModal
