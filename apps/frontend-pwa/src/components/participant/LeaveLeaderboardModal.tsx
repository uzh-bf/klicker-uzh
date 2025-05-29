import { Button, H2, ModalLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface LeaveLeaderboardModalProps {
  isModalOpen: boolean
  setIsModalOpen: (isModalOpen: boolean) => void
  onConfirm: () => void
}

function LeaveLeaderboardModal({
  isModalOpen,
  setIsModalOpen,
  onConfirm,
}: LeaveLeaderboardModalProps) {
  const t = useTranslations()

  return (
    <ModalLegacy
      hideCloseButton
      onPrimaryAction={
        <Button
          destructive
          onClick={() => onConfirm()}
          data={{ cy: 'confirm-leave-course-leaderboard' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setIsModalOpen(false)}
          data={{ cy: 'cancel-leave-course-leaderboard' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
      }
      onClose={(): void => setIsModalOpen(false)}
      open={isModalOpen}
      className={{ content: 'w-[40rem] !pt-0' }}
    >
      <div>
        <H2>{t('pwa.courses.leaveLeaderboardTitle')}</H2>
        <div>{t('pwa.courses.leaveLeaderboardConfirmation')}</div>
        <div className="mb-2 mt-6 text-sm italic">
          {t('pwa.courses.leaveLeaderboardInformation')}
        </div>
      </div>
    </ModalLegacy>
  )
}

export default LeaveLeaderboardModal
