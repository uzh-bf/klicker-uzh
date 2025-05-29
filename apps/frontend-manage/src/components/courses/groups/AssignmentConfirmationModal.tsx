import { useMutation } from '@apollo/client'
import {
  GetCourseGroupsDocument,
  ManualRandomGroupAssignmentsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, ToastLegacy, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

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
  const [showError, setShowError] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
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
    <>
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
            setShowSuccess(true)
            setOpen(false)
          } else {
            console.error('Error while creating random groups')
            setShowError(true)
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
      {showError && (
        <ToastLegacy
          dismissible
          type="error"
          openExternal={showError}
          onCloseExternal={() => setShowError(false)}
          duration={5000}
          className={{ root: 'max-w-[30rem]' }}
        >
          {t('manage.course.groupAssignmentFailed')}
        </ToastLegacy>
      )}
      {showSuccess && (
        <ToastLegacy
          dismissible
          type="success"
          openExternal={showSuccess}
          onCloseExternal={() => setShowSuccess(false)}
          duration={5000}
          className={{ root: 'max-w-[30rem]' }}
        >
          {t('manage.course.groupAssignmentSuccessful')}
        </ToastLegacy>
      )}
    </>
  )
}

export default AssignmentConfirmationModal
