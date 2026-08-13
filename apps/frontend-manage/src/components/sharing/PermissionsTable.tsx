import {
  faCheckCircle,
  faCircleXmark,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ObjectType, PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import useObjectActionPermissions from './useObjectActionPermissions'

function PermissionsTable({
  objectType,
  activePermissionLevel,
}: {
  objectType: ObjectType
  activePermissionLevel?: PermissionLevel
}) {
  const t = useTranslations()
  const actionPermissions = useObjectActionPermissions({ objectType })

  // execution rights are only available for activities and courses
  const showExecution =
    objectType === ObjectType.Course ||
    objectType === ObjectType.LiveQuiz ||
    objectType === ObjectType.PracticeQuiz ||
    objectType === ObjectType.MicroLearning ||
    objectType === ObjectType.GroupActivity

  // map access levels to indices
  const permissionLevelToColumnIndex = {
    [PermissionLevel.Read]: 1, // Read is the first column (index 1)
    [PermissionLevel.Execute]: showExecution ? 2 : -1, // if shown, Execution is the second column (index 2)
    [PermissionLevel.Write]: showExecution ? 3 : 2, // Write is the third column (index 3)
    [PermissionLevel.Admin]: showExecution ? 4 : 3, // Admin is the fourth column (index 4)
    [PermissionLevel.Owner]: -1, // Owner rights are not present in this table
  }

  // get the active column index based on the corresponding access level
  const activeColumnIndex = activePermissionLevel
    ? permissionLevelToColumnIndex[activePermissionLevel]
    : -1
  const permissionColumns = [
    PermissionLevel.Read,
    ...(showExecution ? [PermissionLevel.Execute] : []),
    PermissionLevel.Write,
    PermissionLevel.Admin,
    PermissionLevel.Owner,
  ]

  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border-b shadow-sm">
      <thead>
        <tr className="bg-gray-50">
          {[
            t('shared.generic.actions'),
            t('shared.generic.read'),
            ...(showExecution ? [t('shared.generic.execute')] : []),
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
                key={permissionColumns[index]}
                className="px-4 py-3 text-center"
              >
                <FontAwesomeIcon
                  icon={hasPermission ? faCheckCircle : faCircleXmark}
                  className={`text-lg ${
                    hasPermission ? 'text-green-700' : 'text-red-600'
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
