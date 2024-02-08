import { useMutation } from '@apollo/client'
import {
  DeleteLearningElementDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface LearningElementDeletionModalProps {
  elementId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}

function LearningElementDeletionModal({
  elementId,
  title,
  open,
  setOpen,
}: LearningElementDeletionModalProps) {
  const t = useTranslations()

  // TODO: implement more efficiently with working update instead of expensive refetch
  const [deleteLearningElement] = useMutation(DeleteLearningElementDocument, {
    variables: { id: elementId },
    refetchQueries: [GetSingleCourseDocument],
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await deleteLearningElement()
            setOpen(false)
          }}
          className={{
            root: twMerge('bg-red-600 font-bold text-white'),
          }}
          data={{ cy: 'confirm-delete-practice-quiz' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'cancel-delete-practice-quiz' }}
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
        <H2>{t('manage.course.deletePracticeQuiz')}</H2>
        <div>{t('manage.course.confirmDeletionPracticeQuiz')}</div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          {t('manage.course.hintDeletionPracticeQuiz')}
        </div>
      </div>
    </Modal>
  )
}

export default LearningElementDeletionModal
