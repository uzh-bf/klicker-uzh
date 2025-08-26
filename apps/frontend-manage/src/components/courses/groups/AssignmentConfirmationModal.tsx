import { useMutation } from '@apollo/client'
import {
  GetCourseGroupsDocument,
  GetSingleCourseDocument,
  ManualRandomGroupAssignmentsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function AssignmentConfirmationModal({
  courseId,
  onClose,
}: {
  courseId: string
  onClose: () => void
}) {
  const t = useTranslations()
  const [
    manualRandomGroupAssignments,
    { loading: randomGroupCreationLoading },
  ] = useMutation(ManualRandomGroupAssignmentsDocument, {
    update: (cache, { data }) => {
      // check if the finalization was successful
      if (!data?.manualRandomGroupAssignments) return

      // update the modified course settings
      cache.updateQuery(
        { query: GetSingleCourseDocument, variables: { courseId } },
        (qData) => {
          if (!qData?.course) return qData

          return {
            course: {
              ...qData.course,
              randomAssignmentFinalized: true,
              groupDeadlineDate: new Date(),

              numOfParticipantGroups: data.manualRandomGroupAssignments!.length,
            },
          }
        }
      )

      // update the course participant groups
      cache.updateQuery(
        { query: GetCourseGroupsDocument, variables: { courseId } },
        (qData) => {
          if (!qData?.getCourseGroups) return qData

          return {
            getCourseGroups: {
              ...qData.getCourseGroups,
              groupAssignmentPoolEntries: [],
              participantGroups: data.manualRandomGroupAssignments!,
            },
          }
        }
      )
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.course.finalizeRandomGroupAssignment')}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={randomGroupCreationLoading}
      onPrimaryAction={async () => {
        const res = await manualRandomGroupAssignments({
          variables: { courseId: courseId },
        })
        if (res.data?.manualRandomGroupAssignments) {
          toast({
            type: 'success',
            message: t('manage.course.groupAssignmentSuccessful'),
            options: { duration: 5000 },
          })
          onClose()
        } else {
          console.error('Error while creating random groups')
          toast({
            type: 'error',
            message: t('manage.course.groupAssignmentFailed'),
            options: { duration: 5000 },
          })
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-random-group-assignment' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-random-group-assignment' }}
    >
      <div className="mb-2 font-bold">{t('shared.generic.pleaseReview')}</div>
      <UserNotification type="warning">
        {t.rich('manage.course.confirmRandomGroupAssignment', {
          ul: (children) => <ul className="list-disc">{children}</ul>,
          li: (children) => <li>{children}</li>,
        })}
      </UserNotification>
    </Modal>
  )
}

export default AssignmentConfirmationModal
