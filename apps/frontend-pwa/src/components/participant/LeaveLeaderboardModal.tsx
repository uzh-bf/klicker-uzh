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
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setIsModalOpen(false)}>
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setIsModalOpen(false)}
      open={isModalOpen}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>{t('pwa.courses.leaveCourseTitle')}</H2>
        <div>{t('pwa.courses.leaveCourseConfirmation')}</div>
        <div className="mt-6 mb-2 text-sm italic">
          {t('pwa.courses.leaveCourseInformation')}
        </div>
      </div>
    </Modal>
  )
}

export default LeaveLeaderboardModal
