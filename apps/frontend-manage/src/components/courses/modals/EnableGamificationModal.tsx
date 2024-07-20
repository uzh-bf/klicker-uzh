import { useMutation } from '@apollo/client'
import {
  EnableCourseGamificationDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface EnableGamificationModalProps {
  courseId: string
  open: boolean
  setOpen: (open: boolean) => void
}

function EnableGamificationModal({
  courseId,
  open,
  setOpen,
}: EnableGamificationModalProps) {
  const t = useTranslations()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [enableGamification] = useMutation(EnableCourseGamificationDocument, {
    variables: { courseId },
    optimisticResponse: {
      enableCourseGamification: {
        id: courseId,
        isGamificationEnabled: true,
        __typename: 'Course',
      },
    },
    refetchQueries: [
      {
        query: GetSingleCourseDocument,
        variables: { id: courseId },
      },
    ],
  })

  return (
    <Modal
      title={t('manage.course.enableGamification')}
      onPrimaryAction={
        <Button
          onClick={async () => {
            setIsSubmitting(true)
            await enableGamification()
            setIsSubmitting(false)
            setOpen(false)
          }}
          className={{
            root: 'font-bold text-white bg-primary-80 text-base',
          }}
          data={{ cy: 'confirm-enable-gamification' }}
          loading={isSubmitting}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'cancel-enable-gamification' }}
          className={{ root: 'text-base' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      className={{
        content: 'w-[40rem] min-h-max h-max self-center pt-0',
        title: 'text-xl',
      }}
    >
      <UserNotification type="warning">
        {t('manage.course.enableGamificationWarning')}
      </UserNotification>
    </Modal>
  )
}

export default EnableGamificationModal
