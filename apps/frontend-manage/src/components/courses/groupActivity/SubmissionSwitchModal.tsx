import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface SubmissionSwitchModalProps {
  nextSubmission: number
  setSelectedSubmission: (submissionId: number) => void
  setCurrentEditing: (editing: boolean) => void
  setSwitchingModal: (switching: boolean) => void
}

function SubmissionSwitchModal({
  nextSubmission,
  setSelectedSubmission,
  setCurrentEditing,
  setSwitchingModal,
}: SubmissionSwitchModalProps) {
  const t = useTranslations()

  return (
    <Modal
      open
      title={t('manage.groupActivity.switchSubmission')}
      primaryLabel={t('shared.generic.confirm')}
      onPrimaryAction={() => {
        setSelectedSubmission(nextSubmission)
        setCurrentEditing(false)
        setSwitchingModal(false)
      }}
      dataPrimaryAction={{ cy: 'confirm-submission-switch' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => setSwitchingModal(false)}
      dataSecondaryAction={{ cy: 'cancel-submission-switch' }}
      onClose={(): void => setSwitchingModal(false)}
      hideCloseButton={true}
      className={{ content: 'max-w-xl' }}
    >
      <div className="text-base">
        {t('manage.groupActivity.confirmSubmissionSwitch')}
      </div>
    </Modal>
  )
}

export default SubmissionSwitchModal
