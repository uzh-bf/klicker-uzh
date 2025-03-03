import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface SubmissionSwitchModalProps {
  nextSubmission: number
  switchingModal: boolean
  setSelectedSubmission: (submissionId: number) => void
  setCurrentEditing: (editing: boolean) => void
  setSwitchingModal: (switching: boolean) => void
}

function SubmissionSwitchModal({
  nextSubmission,
  switchingModal,
  setSelectedSubmission,
  setCurrentEditing,
  setSwitchingModal,
}: SubmissionSwitchModalProps) {
  const t = useTranslations()

  return (
    <Modal
      title={t('manage.groupActivity.switchSubmission')}
      onPrimaryAction={
        <Button
          primary
          onClick={() => {
            setSelectedSubmission(nextSubmission)
            setCurrentEditing(false)
            setSwitchingModal(false)
          }}
          data={{ cy: 'confirm-submission-switch' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setSwitchingModal(false)}
          data={{ cy: 'cancel-submission-switch' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
      }
      onClose={(): void => setSwitchingModal(false)}
      open={switchingModal}
      hideCloseButton={true}
      className={{
        content: 'h-max min-h-max w-[40rem] self-center pt-0',
        title: 'text-xl',
      }}
    >
      <div className="text-base">
        {t('manage.groupActivity.confirmSubmissionSwitch')}
      </div>
    </Modal>
  )
}

export default SubmissionSwitchModal
