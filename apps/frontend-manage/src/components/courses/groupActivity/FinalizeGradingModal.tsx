import { useMutation } from '@apollo/client'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FinalizeGroupActivityGradingDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, Toast } from '@uzh-bf/design-system'
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
  const [finalizeGroupActivityGrading] = useMutation(
    FinalizeGroupActivityGradingDocument
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

  return (
    <>
      <Modal
        title={t('manage.groupActivity.finalizeGrading')}
        onPrimaryAction={
          <Button
            loading={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true)
              const { data } = await finalizeGroupActivityGrading({
                variables: { id: activityId },
              })

              if (data?.finalizeGroupActivityGrading?.id) {
                setSuccessToast(true)
              } else {
                setErrorToast(true)
              }
              setIsSubmitting(false)
              setOpen(false)
            }}
            className={{
              root: 'bg-primary-80 text-base font-bold text-white',
            }}
            data={{ cy: 'confirm-finalize-grading' }}
          >
            {t('shared.generic.confirm')}
          </Button>
        }
        onSecondaryAction={
          <Button
            onClick={(): void => setOpen(false)}
            data={{ cy: 'cancel-finalize-grading' }}
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
      <Toast
        openExternal={successToast}
        setOpenExternal={setSuccessToast}
        type="success"
        duration={4000}
      >
        {t('manage.groupActivity.finalizeGradingSuccess')}
      </Toast>
      <Toast
        openExternal={errorToast}
        setOpenExternal={setErrorToast}
        type="error"
        duration={6000}
      >
        {t('manage.groupActivity.finalizeGradingError')}
      </Toast>
    </>
  )
}

export default FinalizeGradingModal
