import { useMutation } from '@apollo/client'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FinalizeGroupActivityGradingDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface FinalizeGradingModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
}

function FinalizeGradingModal({
  open,
  setOpen,
  activityId,
}: FinalizeGradingModalProps) {
  const t = useTranslations()
  const [finalizeGroupActivityGrading, { loading: finalizingGrading }] =
    useMutation(FinalizeGroupActivityGradingDocument)

  return (
    <>
      <Modal
        title={t('manage.groupActivity.finalizeGrading')}
        primaryLabel={t('shared.generic.confirm')}
        primaryLoading={finalizingGrading}
        onPrimaryAction={async () => {
          const { data } = await finalizeGroupActivityGrading({
            variables: { id: activityId },
          })

          if (data?.finalizeGroupActivityGrading?.id) {
            toast({
              type: 'success',
              message: t('manage.groupActivity.finalizeGradingSuccess'),
              options: { duration: 4000 },
            })
          } else {
            toast({
              type: 'error',
              message: t('manage.groupActivity.finalizeGradingError'),
              options: { duration: 6000 },
            })
          }
          setOpen(false)
        }}
        dataPrimaryAction={{ cy: 'confirm-finalize-grading' }}
        secondaryLabel={t('shared.generic.cancel')}
        onSecondaryAction={() => setOpen(false)}
        dataSecondaryAction={{ cy: 'cancel-finalize-grading' }}
        onClose={() => setOpen(false)}
        open={open}
        hideCloseButton={true}
        className={{ content: 'max-w-xl' }}
      >
        <div className="flex flex-row items-center gap-4">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            size="xl"
            className="text-orange-600"
          />
          <div className="text-base">
            {t('manage.groupActivity.confirmFinalizeGrading')}
          </div>
        </div>
      </Modal>
    </>
  )
}

export default FinalizeGradingModal
