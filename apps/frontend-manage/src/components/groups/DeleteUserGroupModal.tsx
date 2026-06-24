import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../lib/trpc'
import ConfirmationItem from '../common/ConfirmationItem'

function DeleteUserGroupModal({
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
  const deleteUserGroup = trpc.sharing.deleteUserGroup.useMutation()
  const [deletePending, setDeletePending] = useState(false)
  const loading = deleteUserGroup.isLoading || deletePending
  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }
  const refreshUserGroups = () => {
    return utils.sharing.userGroups.invalidate()
  }

  const [confirmations, setConfirmations] = useState({
    resolveGroup: false,
    revokeDirectPermissions: false,
    irreversibleAction: false,
  })

  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('manage.userGroups.deleteGroupError'),
      options: { duration: 10000 },
    })

  // on open, reset confirmations
  useEffect(() => {
    setConfirmations({
      resolveGroup: false,
      revokeDirectPermissions: false,
      irreversibleAction: false,
    })
  }, [])

  return (
    <Modal
      open
      onClose={handleClose}
      title={t('manage.userGroups.deleteGroup')}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!loading && <Button.Icon icon={faTrashCan} />}
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      primaryDisabled={
        loading || Object.values(confirmations).some((value) => !value)
      }
      onPrimaryAction={async () => {
        if (loading) return

        let releasePending = true
        setDeletePending(true)

        try {
          const success = await deleteUserGroup.mutateAsync({ groupId })
          if (success.deleted) {
            await refreshUserGroups()
            releasePending = false
            onSuccess()
          } else {
            onErrorToast()
          }
        } catch (error) {
          console.error('Error deleting user group:', error)
          onErrorToast()
        } finally {
          if (releasePending) {
            setDeletePending(false)
          }
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-delete-group' }}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <Button.Icon icon={faBan} />
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </div>
      }
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-delete-group' }}
      className={{ content: 'max-w-2xl' }}
    >
      <div className="mb-3">
        {t('manage.userGroups.confirmDeleteGroup', { groupName })}
      </div>

      <div className="mb-2 flex flex-col gap-2">
        <ConfirmationItem
          notApplicable={false}
          confirmed={confirmations.resolveGroup}
          label={t('manage.userGroups.resolveGroupConfirmation')}
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              resolveGroup: true,
            }))
          }}
          confirmationType="delete"
          data={{ cy: 'delete-group-resolve-group-confirm' }}
        />
        <ConfirmationItem
          notApplicable={false}
          confirmed={confirmations.revokeDirectPermissions}
          label={t('manage.userGroups.revokeDirectPermissionsConfirmation')}
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              revokeDirectPermissions: true,
            }))
          }}
          confirmationType="delete"
          data={{ cy: 'delete-group-revoke-permissions-confirm' }}
        />
        <ConfirmationItem
          notApplicable={false}
          confirmed={confirmations.irreversibleAction}
          label={t('manage.userGroups.irreversibleActionConfirmation')}
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              irreversibleAction: true,
            }))
          }}
          confirmationType="delete"
          data={{ cy: 'delete-group-irrevocable-action-confirm' }}
        />
      </div>
    </Modal>
  )
}

export default DeleteUserGroupModal
