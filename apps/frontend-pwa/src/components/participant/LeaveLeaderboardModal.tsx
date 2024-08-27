import { Button, H2, Modal } from '@uzh-bf/design-system'
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
    <Modal
      onPrimaryAction={
        <Button
          onClick={() => onConfirm()}
          className={{ root: 'bg-red-600 font-bold text-white' }}
          data={{ cy: 'confirm-leave-course-leaderboard' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setIsModalOpen(false)}
          data={{ cy: 'cancel-leave-course-leaderboard' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setIsModalOpen(false)}
      open={isModalOpen}
      hideCloseButton={true}
      className={{ content: 'h-max w-[40rem] self-center pt-0' }}
    >
      <div>
        <H2>{t('pwa.courses.leaveCourseTitle')}</H2>
        <div>{t('pwa.courses.leaveCourseConfirmation')}</div>
        <div className="mb-2 mt-6 text-sm italic">
          {t('pwa.courses.leaveCourseInformation')}
        </div>
      </div>
    </Modal>
  )
}

export default LeaveLeaderboardModal
