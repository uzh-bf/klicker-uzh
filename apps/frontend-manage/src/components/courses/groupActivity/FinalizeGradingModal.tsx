import { useMutation } from '@apollo/client'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FinalizeGroupActivityGradingDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal, ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

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

  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

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
            setSuccessToast(true)
          } else {
            setErrorToast(true)
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
      <ToastLegacy
        dismissible
        openExternal={successToast}
        onCloseExternal={() => setSuccessToast(false)}
        type="success"
        duration={4000}
      >
        {t('manage.groupActivity.finalizeGradingSuccess')}
      </ToastLegacy>
      <ToastLegacy
        dismissible
        openExternal={errorToast}
        onCloseExternal={() => setErrorToast(false)}
        type="error"
        duration={6000}
      >
        {t('manage.groupActivity.finalizeGradingError')}
      </ToastLegacy>
    </>
  )
}

export default FinalizeGradingModal
