import { useMutation } from '@apollo/client'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FinalizeGroupActivityGradingDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, ModalLegacy, ToastLegacy } from '@uzh-bf/design-system'
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
      <ModalLegacy
        title={t('manage.groupActivity.finalizeGrading')}
        onPrimaryAction={
          <Button
            primary
            loading={finalizingGrading}
            onClick={async () => {
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
            data={{ cy: 'confirm-finalize-grading' }}
          >
            <Button.Label>{t('shared.generic.confirm')}</Button.Label>
          </Button>
        }
        onSecondaryAction={
          <Button
            onClick={(): void => setOpen(false)}
            data={{ cy: 'cancel-finalize-grading' }}
            className={{ root: 'text-base' }}
          >
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
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
      </ModalLegacy>
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
