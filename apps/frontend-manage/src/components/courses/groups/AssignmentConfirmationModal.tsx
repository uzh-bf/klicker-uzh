import { useMutation } from '@apollo/client'
import {
  GetCourseGroupsDocument,
  ManualRandomGroupAssignmentsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
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
      title={t('manage.course.finalizeRandomGroupAssignment')}
      onPrimaryAction={
        <Button
          onClick={async () => {
            const res = await manualRandomGroupAssignments({
              variables: { courseId: courseId },
            })
            if (res.data?.manualRandomGroupAssignments) {
              setOpen(false)
            }
          }}
          className={{
            root: 'bg-primary-80 text-base font-bold text-white',
          }}
          data={{ cy: 'confirm-random-group-assignment' }}
          loading={randomGroupCreationLoading}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'cancel-random-group-assignment' }}
          className={{ root: 'text-base' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      className={{
        content: 'h-max min-h-max w-[40rem] self-center pt-0',
        title: 'text-xl',
      }}
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
