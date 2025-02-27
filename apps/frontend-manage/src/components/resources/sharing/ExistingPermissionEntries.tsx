import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AccessLevel,
  CatalogObjectType,
  PermissionInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Select, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import useAccessLevelSelection from '../../../lib/hooks/useAccessLevelSelection'

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
      onClick={async () => await onPermissionRemoval(permission.permissionId)}
      data={{
        cy: permission.username
          ? `revoke-permission-${permission.username}`
          : `revoke-permission-${permission.userGroupName}`,
      }}
    >
      <FontAwesomeIcon icon={faTrashCan} className="mt-1 h-4 w-4" />
    </Button>
  )

  return permissions
    ?.filter((permission) => permission.username || permission.userGroupName)
    .map((permission, index) => (
      <tr
        key={index}
        className="border-t border-gray-200 hover:bg-gray-50"
        data-cy={
          permission.username
            ? `permission-${permission.username}`
            : `permission-${permission.userGroupName}`
        }
      >
        <td className="px-4 py-3 text-sm text-gray-900">
          {permission.username
            ? `${permission.username} (${permission.userEmail})`
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
            onChange={async (value) =>
              await onAccessLevelChange({
                permissionId: permission.permissionId,
                newAccessLevel: value as AccessLevel,
              })
            }
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
    ))
}

export default ExistingPermissionEntries
