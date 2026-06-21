import {
  faBan,
  faPersonWalkingArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../lib/trpc'

function LeaveUserGroupModal({
  onClose,
  onSuccess,
  groupId,
  groupName,
}: {
  onClose: () => void
  onSuccess: () => void
  groupId: number
  groupName: string
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const leaveUserGroup = trpc.sharing.leaveUserGroup.useMutation()
  const loading = leaveUserGroup.isLoading
  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }
  const refreshUserGroups = () => {
    void utils.sharing.userGroups.invalidate().catch(console.error)
  }

  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('manage.userGroups.leaveGroupError'),
      options: { duration: 10000 },
    })

  return (
    <Modal
      open
      onClose={handleClose}
      title={t('manage.userGroups.leaveGroup')}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!loading && <FontAwesomeIcon icon={faPersonWalkingArrowRight} />}
          <span>{t('shared.generic.confirm')}</span>
        </div>
      }
      primaryLoading={loading}
      primaryDisabled={loading}
      onPrimaryAction={async () => {
        try {
          const success = await leaveUserGroup.mutateAsync({ groupId })
          if (success.left) {
            refreshUserGroups()
            onSuccess()
          } else {
            onErrorToast()
          }
        } catch (error) {
          console.error('Error leaving user group:', error)
          onErrorToast()
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-leave-group' }}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faBan} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-leave-group' }}
      className={{ content: 'max-w-xl' }}
    >
      {t('manage.userGroups.confirmLeaveGroup', { groupName })}
    </Modal>
  )
}

export default LeaveUserGroupModal
