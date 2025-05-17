import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  ObjectType,
  PermissionInfo,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Select, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import usePermissionLevelSelection from '../../lib/hooks/usePermissionLevelSelection'
import ModifyOwnPermissionsModal from './ModifyOwnPermissionsModal'
import PermissionRevocationModal from './PermissionRevocationModal'

function ExistingPermissionEntries({
  type,
  permissions,
  changeLoading,
  showPropagationSetting,
  onPermissionLevelChange,
  onPermissionRemoval,
}: {
  type: ObjectType
  permissions: PermissionInfo[]
  changeLoading: boolean
  showPropagationSetting: boolean
  onPermissionLevelChange: ({
    permissionId,
    newPermissionLevel,
    newPropagation,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
    newPropagation: boolean
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
    newPropagation?: boolean
    action: 'change' | 'remove'
  }>({
    open: false,
    action: 'change',
  })

  // state for managing the permission revocation modal
  const [revocationModal, setRevocationModal] = useState<{
    open: boolean
    permissionId?: number
    username?: string
    userGroup?: string
  }>({
    open: false,
  })

  // handle access level change with confirmation for own permissions
  const handlePermissionLevelChange = async (
    permissionId: number,
    newPermissionLevel: PermissionLevel,
    newPropagation: boolean,
    isOwn: boolean
  ) => {
    if (isOwn) {
      setModifyOwnPermissionsModal({
        open: true,
        permissionId,
        newPermissionLevel,
        newPropagation,
        action: 'change',
      })
    } else {
      await onPermissionLevelChange({
        permissionId,
        newPermissionLevel,
        newPropagation,
      })
    }
  }

  // handle permission removal with confirmation for own permissions
  const handleRemovePermission = async (
    permissionId: number,
    isOwn: boolean,
    username?: string,
    userGroup?: string
  ) => {
    if (isOwn) {
      setModifyOwnPermissionsModal({
        open: true,
        permissionId,
        action: 'remove',
      })
    } else {
      setRevocationModal({
        open: true,
        permissionId,
        username,
        userGroup,
      })
    }
  }

  // confirm modifying own permissions
  const confirmModifyOwnPermissions = async () => {
    if (modifyOwnPermissionsModal.action === 'change') {
      await onPermissionLevelChange({
        permissionId: modifyOwnPermissionsModal.permissionId!,
        newPermissionLevel: modifyOwnPermissionsModal.newPermissionLevel!,
        newPropagation: modifyOwnPermissionsModal.newPropagation!,
      })
    } else {
      await onPermissionRemoval(modifyOwnPermissionsModal.permissionId!)
    }
    setModifyOwnPermissionsModal({ ...modifyOwnPermissionsModal, open: false })
  }

  // confirm permission revocation
  const confirmRevocation = async () => {
    await onPermissionRemoval(revocationModal.permissionId!)
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
                    permission.propagation ?? false,
                    permission.isOwn ?? false
                  )
                }}
                className={{
                  trigger: 'h-7 text-sm text-gray-900',
                  item: 'text-sm',
                }}
                data={{
                  cy: permission.username
                    ? `permission-level-${permission.username}`
                    : `permission-level-${permission.userGroupName}`,
                }}
              />
            </td>
            {showPropagationSetting ? (
              <td className="w-24">
                <Switch
                  size="sm"
                  checked={permission.propagation ?? false}
                  onCheckedChange={async (newValue) => {
                    await handlePermissionLevelChange(
                      permission.permissionId,
                      permission.permissionLevel,
                      newValue,
                      permission.isOwn ?? false
                    )
                  }}
                  disabled={changeLoading}
                  data={{
                    cy: permission.username
                      ? `permission-propagation-${permission.username}`
                      : `permission-propagation-${permission.userGroupName}`,
                  }}
                  className={{ root: 'justify-center' }}
                />
              </td>
            ) : null}
            <td className="w-10 text-center">
              <Button
                basic
                className={{
                  root: 'mt-1 px-2 py-2 text-red-600 hover:text-red-800',
                }}
                onClick={async () => {
                  await handleRemovePermission(
                    permission.permissionId,
                    permission.isOwn ?? false,
                    permission.username ?? undefined,
                    permission.userGroupName ?? undefined
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
      <PermissionRevocationModal
        open={revocationModal.open}
        onClose={() => setRevocationModal({ ...revocationModal, open: false })}
        onRevocation={confirmRevocation}
        username={revocationModal.username}
        userGroup={revocationModal.userGroup}
      />
    </>
  )
}

export default ExistingPermissionEntries
