import { useMutation } from '@apollo/client'
import {
  GetCourseGroupsDocument,
  ManualRandomGroupAssignmentsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function AssignmentConfirmationModal({
  courseId,
  open,
  setOpen,
}: {
  courseId: string
  open: boolean
  setOpen: (value: boolean) => void
}) {
  const t = useTranslations()
  const [
    manualRandomGroupAssignments,
    { loading: randomGroupCreationLoading },
  ] = useMutation(ManualRandomGroupAssignmentsDocument, {
    refetchQueries: [
      {
        query: GetCourseGroupsDocument,
        variables: { courseId: courseId },
      },
    ],
    // TODO: use update for more efficiency - does not work properly yet
    // update: (cache, { data }) => {
    //   const cacheData = cache.readQuery({
    //     query: GetCourseGroupsDocument,
    //     variables: { courseId: courseId },
    //   })
    //   cache.writeQuery({
    //     query: GetCourseGroupsDocument,
    //     variables: { courseId: courseId },
    //     data: {
    //       getCourseGroups: {
    //         ...cacheData?.getCourseGroups,
    //         groupAssignmentPoolEntries: [],
    //         participantGroups: [
    //           ...(data?.manualRandomGroupAssignments?.participantGroups ?? []),
    //         ],
    //       },
    //     },
    //   })
    // },
  })

  return (
    <Modal
      open={open}
      onClose={(): void => setOpen(false)}
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
          setOpen(false)
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
      onSecondaryAction={() => setOpen(false)}
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
