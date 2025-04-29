import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  PermissionInfo,
  PermissionLevel,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import usePermissionLevelSelection from '../../lib/hooks/usePermissionLevelSelection'
import ModifyOwnPermissionsModal from './ModifyOwnPermissionsModal'

function ExistingPermissionEntries({
  type,
  permissions,
  changeLoading,
  onPermissionLevelChange,
  onPermissionRemoval,
}: {
  type: SharingObjectType
  permissions: PermissionInfo[]
  changeLoading: boolean
  onPermissionLevelChange: ({
    permissionId,
    newPermissionLevel,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
  }) => Promise<void>
  onPermissionRemoval: (permissionId: number) => Promise<void>
}) {
  const permissionLevelSelectItems = usePermissionLevelSelection({ type })
  const t = useTranslations()

  // state for managing the permission modification modal
  const [modifyOwnPermissionsModal, setModifyOwnPermissionsModal] = useState<{
    open: boolean
    permissionId?: number
    newPermissionLevel?: PermissionLevel
    action: 'change' | 'remove'
  }>({
    open: false,
    action: 'change',
  })

  // handle access level change with confirmation for own permissions
  const handlePermissionLevelChange = async (
    permissionId: number,
    newPermissionLevel: PermissionLevel,
    isOwn: boolean
  ) => {
    if (isOwn) {
      setModifyOwnPermissionsModal({
        open: true,
        permissionId,
        newPermissionLevel,
        action: 'change',
      })
    } else {
      await onPermissionLevelChange({
        permissionId,
        newPermissionLevel,
      })
    }
  }

  // handle permission removal with confirmation for own permissions
  const handleRemovePermission = async (
    permissionId: number,
    isOwn: boolean
  ) => {
    if (isOwn) {
      setModifyOwnPermissionsModal({
        open: true,
        permissionId,
        action: 'remove',
      })
    } else {
      await onPermissionRemoval(permissionId)
    }
  }

  // confirm modifying own permissions
  const confirmModifyOwnPermissions = async () => {
    if (modifyOwnPermissionsModal.action === 'change') {
      await onPermissionLevelChange({
        permissionId: modifyOwnPermissionsModal.permissionId!,
        newPermissionLevel: modifyOwnPermissionsModal.newPermissionLevel!,
      })
    } else {
      await onPermissionRemoval(modifyOwnPermissionsModal.permissionId!)
    }
    setModifyOwnPermissionsModal({ ...modifyOwnPermissionsModal, open: false })
  }

  return (
    <>
      {permissions
        ?.filter(
          (permission) => permission.username || permission.userGroupName
        )
        .map((permission, index) => (
          <tr
            key={index}
            className={`border-t border-gray-200 hover:bg-gray-50 ${
              permission.isOwn ? 'bg-blue-50 hover:bg-blue-100' : ''
            }`}
            data-cy={
              permission.username
                ? `permission-${permission.username}`
                : `permission-${permission.userGroupName}`
            }
          >
            <td className="px-4 py-3 text-sm text-gray-900">
              {permission.username
                ? `${permission.username} (${permission.userEmail})${
                    permission.isOwn ? ' ' + t('manage.sharing.ownAccess') : ''
                  }`
                : '-'}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">
              {permission.userGroupName || '-'}
            </td>
            <td className="px-4 py-1.5 text-gray-900">
              <Select
                value={permission.permissionLevel}
                items={permissionLevelSelectItems}
                disabled={changeLoading}
                onChange={async (value) => {
                  await handlePermissionLevelChange(
                    permission.permissionId,
                    value as PermissionLevel,
                    permission.isOwn ?? false
                  )
                }}
                className={{
                  trigger: 'h-7 text-sm text-gray-900',
                }}
                data={{
                  cy: permission.username
                    ? `permission-level-${permission.username}`
                    : `permission-level-${permission.userGroupName}`,
                }}
              />
            </td>
            <td className="w-10 text-center">
              <Button
                basic
                className={{
                  root: 'mt-1 px-2 py-2 text-red-600 hover:text-red-800',
                }}
                onClick={async () => {
                  await handleRemovePermission(
                    permission.permissionId,
                    permission.isOwn ?? false
                  )
                }}
                data={{
                  cy: permission.username
                    ? `revoke-permission-${permission.username}`
                    : `revoke-permission-${permission.userGroupName}`,
                }}
              >
                <Button.Icon withoutLabel icon={faTrashCan} />
              </Button>
            </td>
          </tr>
        ))}

      <ModifyOwnPermissionsModal
        open={modifyOwnPermissionsModal.open}
        onClose={() =>
          setModifyOwnPermissionsModal({
            ...modifyOwnPermissionsModal,
            open: false,
          })
        }
        onConfirm={confirmModifyOwnPermissions}
        action={modifyOwnPermissionsModal.action}
        newPermissionLevel={modifyOwnPermissionsModal.newPermissionLevel}
      />
    </>
  )
}

export default ExistingPermissionEntries
