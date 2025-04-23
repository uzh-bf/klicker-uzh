import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import {
  DeleteUserGroupDocument,
  GetUserGroupsUserDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../common/ConfirmationItem'
import DeleteUserGroupErrorToast from './DeleteUserGroupErrorToast'

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
  const [deleteUserGroup] = useMutation(DeleteUserGroupDocument)

  const [errorToast, setErrorToast] = useState(false)
  const [confirmations, setConfirmations] = useState({
    resolveGroup: false,
    revokeDirectPermissions: false,
    irreversibleAction: false,
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
      className={{ content: '!max-w-2xl' }}
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

      <div className="flex flex-row justify-between">
        <Button>
          <Button.Icon icon={faBan} />
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          destructive
          disabled={Object.values(confirmations).some((value) => !value)}
          onClick={async () => {
            try {
              const { data: success } = await deleteUserGroup({
                variables: {
                  groupId,
                },
                update: (cache, { data }) => {
                  // check if request was successful
                  const success = data?.deleteUserGroup
                  if (!success) return
                  // update list of answer collections
                  const catalogObjects = cache.readQuery({
                    query: GetUserGroupsUserDocument,
                  })
                  if (catalogObjects?.getUserGroupsUser) {
                    cache.writeQuery({
                      query: GetUserGroupsUserDocument,
                      data: {
                        getUserGroupsUser:
                          catalogObjects?.getUserGroupsUser.filter(
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
                setErrorToast(true)
              }
            } catch (error) {
              console.error('Error deleting user group:', error)
              setErrorToast(true)
            }
          }}
        >
          <Button.Icon icon={faTrashCan} />
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      </div>
      <DeleteUserGroupErrorToast
        open={errorToast}
        setOpen={() => setErrorToast(false)}
      />
    </Modal>
  )
}

export default DeleteUserGroupModal
