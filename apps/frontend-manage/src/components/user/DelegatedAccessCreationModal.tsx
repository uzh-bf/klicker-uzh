import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function DelegatedAccessCreationModal({
  confirmationModal,
  setConfirmationModal,
  shortname,
  values,
  isSubmitting,
  isValid,
  submitForm,
}: {
  confirmationModal: boolean
  setConfirmationModal: (value: boolean) => void
  shortname: string
  values: { password: string }
  isSubmitting: boolean
  isValid: boolean
  submitForm: () => void
}) {
  const t = useTranslations()

  return (
    <Modal
      title={t('manage.settings.confirmDelegatedAccess')}
      open={confirmationModal}
      onClose={() => setConfirmationModal(false)}
      className={{ content: 'h-max !min-h-[10rem] max-w-[35rem] !pb-1' }}
    >
      <div>{t('manage.settings.confirmDelegatedAccessTooltip')}</div>
      <div className="my-2 w-max rounded-lg border px-3 py-2 shadow-sm">
        <div>
          <span className="font-bold">{t('shared.generic.shortname')}: </span>
          {shortname}
        </div>
        <div className="flex flex-row items-center gap-4">
          <div>
            <span className="font-bold">{t('shared.generic.password')}: </span>
            {values.password}
          </div>
          <Button
            onClick={() => {
              navigator?.clipboard?.writeText(values.password).then(() => {
                toast({
                  type: 'success',
                  message: t('manage.settings.copiedPassword'),
                  options: { duration: 4000 },
                })
              })
            }}
            className={{ root: 'h-8 w-8' }}
            data={{ cy: 'copy-delegated-login-password' }}
          >
            <Button.Icon withoutLabel icon={faClipboard} />
          </Button>
        </div>
      </div>
      <Button
        primary
        loading={isSubmitting}
        disabled={!isValid}
        onClick={() => submitForm()}
        className={{ root: 'float-right my-2' }}
        data={{ cy: 'confirm-delegated-login-creation' }}
      >
        <Button.Label>{t('shared.generic.confirm')}</Button.Label>
      </Button>
    </Modal>
  )
}

export default DelegatedAccessCreationModal
