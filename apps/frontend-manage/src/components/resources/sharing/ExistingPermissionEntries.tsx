import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AccessLevel,
  CatalogObjectType,
  PermissionInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import useAccessLevelSelection from './useAccessLevelSelection'

function ExistingPermissionEntries({
  type,
  permissions,
  onAccessLevelChange,
  onPermissionRemoval,
}: {
  type: CatalogObjectType
  permissions: PermissionInfo[]
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
          <Button
            basic
            className={{
              root: 'mt-1 text-red-600 hover:text-red-800',
            }}
            onClick={async () =>
              await onPermissionRemoval(permission.permissionId)
            }
            data={{
              cy: permission.username
                ? `remove-permission-${permission.username}`
                : `remove-permission-${permission.userGroupName}`,
            }}
          >
            <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" />
          </Button>
        </td>
      </tr>
    ))
}

export default ExistingPermissionEntries
