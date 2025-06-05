import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import {
  DeleteUserGroupDocument,
  GetUserGroupsUserDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../common/ConfirmationItem'

function DeleteUserGroupModal({
  open,
  onClose,
  onSuccess,
  groupId,
  groupName,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  groupId: number
  groupName: string
}) {
  const t = useTranslations()
  const [deleteUserGroup, { loading }] = useMutation(DeleteUserGroupDocument)

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
    if (open) {
      setConfirmations({
        resolveGroup: false,
        revokeDirectPermissions: false,
        irreversibleAction: false,
      })
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.userGroups.deleteGroup')}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!loading && <Button.Icon icon={faTrashCan} />}
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      primaryDisabled={Object.values(confirmations).some((value) => !value)}
      onPrimaryAction={async () => {
        try {
          const { data: success } = await deleteUserGroup({
            variables: {
              groupId,
            },
            update: (cache, { data }) => {
              // check if request was successful
              const success = data?.deleteUserGroup
              if (!success) return
              // update list of user groups
              const userGroups = cache.readQuery({
                query: GetUserGroupsUserDocument,
              })
              if (userGroups?.getUserGroupsUser) {
                cache.writeQuery({
                  query: GetUserGroupsUserDocument,
                  data: {
                    getUserGroupsUser: userGroups?.getUserGroupsUser.filter(
                      (group) => group.id !== groupId
                    ),
                  },
                })
              }
            },
          })
          if (success?.deleteUserGroup) {
            onSuccess()
          } else {
            onErrorToast()
          }
        } catch (error) {
          console.error('Error deleting user group:', error)
          onErrorToast()
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-delete-group' }}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <Button.Icon icon={faBan} />
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </div>
      }
      onSecondaryAction={onClose}
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
