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
          onClick={() => {
            setSelectedSubmission(nextSubmission)
            setCurrentEditing(false)
            setSwitchingModal(false)
          }}
          className={{
            root: 'font-bold text-white bg-primary-80 text-base',
          }}
          data={{ cy: 'confirm-submission-switch' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setSwitchingModal(false)}
          data={{ cy: 'cancel-submission-switch' }}
          className={{ root: 'text-base' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setSwitchingModal(false)}
      open={switchingModal}
      hideCloseButton={true}
      className={{
        content: 'w-[40rem] min-h-max h-max self-center pt-0',
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
