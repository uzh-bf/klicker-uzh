import {
  faCheckCircle,
  faCircleXmark,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  PermissionLevel,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import useObjectActionPermissions from './useObjectActionPermissions'

function PermissionsTable({
  objectType,
  activePermissionLevel,
}: {
  objectType: SharingObjectType
  activePermissionLevel?: PermissionLevel
}) {
  const t = useTranslations()

  const actionPermissions = useObjectActionPermissions({ objectType })

  // map access levels to indices
  const permissionLevelToColumnIndex = {
    [PermissionLevel.Read]: 1, // Read is the second column (index 1)
    [PermissionLevel.Write]: 2, // Write is the third column (index 2)
    [PermissionLevel.Admin]: 3, // Admin is the fourth column (index 3)
    [PermissionLevel.Execute]: -1, // Execution rights are not present in this table
    [PermissionLevel.Owner]: -1, // Owner rights are not present in this table
  }

  // get the active column index based on the corresponding access level
  const activeColumnIndex = activePermissionLevel
    ? permissionLevelToColumnIndex[activePermissionLevel]
    : -1

  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border-b shadow-sm">
      <thead>
        <tr className="bg-gray-50">
          {[
            t('shared.generic.actions'),
            t('shared.generic.read'),
            t('shared.generic.write'),
            t('shared.generic.admin'),
            t('shared.generic.owner'),
          ].map((title, index) => (
            <th
              key={title}
              className={twMerge(
                'px-4 py-3 text-center text-sm font-bold text-gray-700 first:text-left',
                index === activeColumnIndex ? 'bg-blue-50' : ''
              )}
            >
              {title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white">
        {actionPermissions.map(({ action, permissions }) => (
          <tr
            key={action}
            className="border-t border-gray-200 hover:bg-gray-50"
          >
            <td className="px-4 py-3 text-sm text-gray-900">{action}</td>
            {permissions.map((hasPermission, index) => (
              <td
                key={index}
                className={twMerge(
                  'px-4 py-3 text-center',
                  index === 0 ? 'text-left' : ''
                )}
              >
                <FontAwesomeIcon
                  icon={hasPermission ? faCheckCircle : faCircleXmark}
                  className={`text-lg ${
                    hasPermission ? 'text-green-600' : 'text-red-600'
                  }`}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default PermissionsTable
