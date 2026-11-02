import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface LeaveLeaderboardModalProps {
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

function LeaveLeaderboardModal({
  onClose,
  onConfirm,
  loading = false,
}: LeaveLeaderboardModalProps) {
  const t = useTranslations()

  return (
    <Modal
      open
      hideCloseButton
      escapeDisabled={loading}
      title={t('pwa.courses.leaveLeaderboardTitle')}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      onPrimaryAction={() => {
        if (!loading) onConfirm()
      }}
      dataPrimaryAction={{ cy: 'confirm-leave-course-leaderboard' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => {
        if (!loading) onClose()
      }}
      dataSecondaryAction={{ cy: 'cancel-leave-course-leaderboard' }}
      onClose={() => {
        if (!loading) onClose()
      }}
      className={{ content: 'max-w-xl', title: 'self-start' }}
    >
      <div>{t('pwa.courses.leaveLeaderboardConfirmation')}</div>
      <div className="my-2 text-sm italic">
        {t('pwa.courses.leaveLeaderboardInformation')}
      </div>
    </Modal>
  )
}

export default LeaveLeaderboardModal
