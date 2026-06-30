import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { PermissionLevel } from '@lib/constants/sharingEnums'
import { Button, Select, SelectItem, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import type { PermissionInfo } from './useObjectPermissions'

function PermissionListEntry({
  disabled = false,
  index,
  permission,
  permissionLevelSelectItems,
  handlePermissionLevelChange,
  handleRemovePermission,
  changeLoading,
  showPropagationSetting,
  dataPrefix = '',
}: {
  disabled?: boolean
  index: number
  permission: PermissionInfo
  permissionLevelSelectItems: SelectItem[]
  handlePermissionLevelChange: (
    permissionId: number,
    newPermissionLevel: PermissionLevel,
    newPropagation: boolean,
    isOwn: boolean
  ) => Promise<void>
  handleRemovePermission: (
    permissionId: number,
    isOwn: boolean,
    username?: string | undefined,
    userGroup?: string | undefined
  ) => Promise<void>
  changeLoading: boolean
  showPropagationSetting: boolean
  dataPrefix?: string
}) {
  const t = useTranslations()

  return (
    <tr
      key={index}
      className={twMerge(
        'border-t border-gray-200 hover:bg-gray-50',
        permission.isOwn ? 'bg-blue-50 hover:bg-blue-100/70' : ''
      )}
      data-cy={
        permission.username
          ? `${dataPrefix}permission-${permission.username}`
          : `${dataPrefix}permission-${permission.userGroupName}`
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
          disabled={disabled || changeLoading}
          value={permission.permissionLevel}
          items={[
            ...permissionLevelSelectItems,
            ...(disabled
              ? [
                  {
                    value: PermissionLevel.Owner,
                    label: t('manage.sharing.permissionsOWNER'),
                  },
                ]
              : []),
          ]}
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
          {permission.permissionLevel !== PermissionLevel.Owner && (
            <Switch
              size="sm"
              checked={permission.propagation ?? false}
              onCheckedChange={async (newValue) => {
                await handlePermissionLevelChange(
                  permission.permissionId,
                  permission.permissionLevel as unknown as PermissionLevel,
                  newValue,
                  permission.isOwn ?? false
                )
              }}
              disabled={disabled || changeLoading}
              data={{
                cy: permission.username
                  ? `permission-propagation-${permission.username}`
                  : `permission-propagation-${permission.userGroupName}`,
              }}
              className={{ root: 'justify-center' }}
            />
          )}
        </td>
      ) : null}
      <td className="w-10 text-center">
        {permission.permissionLevel !== PermissionLevel.Owner && (
          <Button
            basic
            disabled={disabled || changeLoading}
            onClick={async () => {
              await handleRemovePermission(
                permission.permissionId,
                permission.isOwn ?? false,
                permission.username ?? undefined,
                permission.userGroupName ?? undefined
              )
            }}
            className={{
              root: 'mr-2 mt-1 px-2 py-2 text-red-600 hover:text-red-800',
            }}
            data={{
              cy: permission.username
                ? `revoke-permission-${permission.username}`
                : `revoke-permission-${permission.userGroupName}`,
            }}
          >
            <Button.Icon withoutLabel icon={faTrashCan} />
          </Button>
        )}
      </td>
    </tr>
  )
}

export default PermissionListEntry
