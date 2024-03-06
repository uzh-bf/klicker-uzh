import { useMutation } from '@apollo/client'
import {
  DeleteMicroLearningDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface MicroLearningDeletionModalProps {
  sessionId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}

function MicroLearningDeletionModal({
  sessionId,
  title,
  open,
  setOpen,
}: MicroLearningDeletionModalProps) {
  const t = useTranslations()

  // TODO: implement more efficiently with working update instead of expensive refetch
  const [deleteMicroLearning] = useMutation(DeleteMicroLearningDocument, {
    variables: { id: sessionId },
    refetchQueries: [GetSingleCourseDocument],
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await deleteMicroLearning()
            setOpen(false)
          }}
          className={{
            root: twMerge('bg-red-600 font-bold text-white'),
          }}
          data={{ cy: 'confirm-delete-microlearning' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'cancel-delete-microlearning' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>{t('manage.course.deleteMicrolearning')}</H2>
        <div>{t('manage.course.confirmDeletionMicrolearning')}</div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          {t('manage.course.hintDeletionMicrolearning')}
        </div>
      </div>
    </Modal>
  )
}

export default MicroLearningDeletionModal
