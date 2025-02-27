import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AccessLevel,
  CatalogObjectType,
  PermissionInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Select, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useAccessLevelSelection from '../../../lib/hooks/useAccessLevelSelection'
import ModifyOwnPermissionsModal from './ModifyOwnPermissionsModal'

function ExistingPermissionEntries({
  type,
  permissions,
  changeLoading,
  onAccessLevelChange,
  onPermissionRemoval,
}: {
  type: CatalogObjectType
  permissions: PermissionInfo[]
  changeLoading: boolean
  onAccessLevelChange: ({
    permissionId,
    newAccessLevel,
  }: {
    permissionId: number
    newAccessLevel: AccessLevel
  }) => Promise<void>
  onPermissionRemoval: (permissionId: number) => Promise<void>
}) {
  const accessLevelSelectItems = useAccessLevelSelection({ type })
  const t = useTranslations()

  // state for managing the permission modification modal
  const [modifyOwnPermissionsModal, setModifyOwnPermissionsModal] = useState<{
    open: boolean
    permissionId?: number
    newAccessLevel?: AccessLevel
    action: 'change' | 'remove'
  }>({
    open: false,
    action: 'change',
  })

  // handle access level change with confirmation for own permissions
  const handleAccessLevelChange = async (
    permissionId: number,
    newAccessLevel: AccessLevel,
    isOwn: boolean
  ) => {
    if (isOwn) {
      setModifyOwnPermissionsModal({
        open: true,
        permissionId,
        newAccessLevel,
        action: 'change',
      })
    } else {
      await onAccessLevelChange({
        permissionId,
        newAccessLevel,
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
      await onAccessLevelChange({
        permissionId: modifyOwnPermissionsModal.permissionId!,
        newAccessLevel: modifyOwnPermissionsModal.newAccessLevel!,
      })
    } else {
      await onPermissionRemoval(modifyOwnPermissionsModal.permissionId!)
    }
    setModifyOwnPermissionsModal({ ...modifyOwnPermissionsModal, open: false })
  }

  const AccessRevokationButton = ({
    permission,
    disabled,
    className,
  }: {
    permission: PermissionInfo
    disabled?: boolean
    className?: string
  }) => (
    <Button
      basic
      disabled={disabled}
      className={{
        root: twMerge('mt-1 text-red-600 hover:text-red-800', className),
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
      <FontAwesomeIcon icon={faTrashCan} className="mt-1 h-4 w-4" />
    </Button>
  )

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
                    permission.isOwn
                      ? ' ' + t('manage.resources.ownAccess')
                      : ''
                  }`
                : '-'}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">
              {permission.userGroupName || '-'}
            </td>
            <td className="px-4 py-1.5 text-gray-900">
              <Select
                value={permission.accessLevel}
                items={accessLevelSelectItems}
                disabled={changeLoading}
                onChange={async (value) => {
                  await handleAccessLevelChange(
                    permission.permissionId,
                    value as AccessLevel,
                    permission.isOwn ?? false
                  )
                }}
                className={{
                  trigger: 'h-7 text-sm text-gray-900',
                }}
                data={{
                  cy: permission.username
                    ? `access-level-permission-${permission.username}`
                    : `access-level-permission-${permission.userGroupName}`,
                }}
              />
            </td>
            <td className="w-10 text-center">
              {permission.isRevokable ? (
                <AccessRevokationButton permission={permission} />
              ) : (
                <Tooltip
                  tooltip={t('manage.resources.revokeAccessDisabledTooltip')}
                  className={{ tooltip: 'max-w-[30rem] text-sm' }}
                >
                  <AccessRevokationButton
                    disabled
                    permission={permission}
                    className="text-gray-400 hover:text-gray-400"
                  />
                </Tooltip>
              )}
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
        newAccessLevel={modifyOwnPermissionsModal.newAccessLevel}
      />
    </>
  )
}

export default ExistingPermissionEntries
