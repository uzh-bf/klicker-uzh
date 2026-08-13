import { ObjectType, PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useObjectPropagatedPermissions from './useObjectPropagatedPermissions'

function PropagatedPermissionsTable({
  objectType,
  activePermissionLevel,
  showPropagationSetting = false,
}: {
  objectType: ObjectType
  activePermissionLevel?: PermissionLevel
  showPropagationSetting?: boolean
}) {
  const t = useTranslations()
  const [propagation, setPropagation] = useState(false)
  const propagatedPermissions = useObjectPropagatedPermissions({
    objectType,
    propagation,
  })

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

  if (!propagatedPermissions) {
    return null
  }

  return (
    <div className="mt-6">
      <div className="font-bold">
        {t('manage.sharing.propagatedPermissions')}
      </div>
      <div className="mb-3">
        {t(`manage.sharing.propagatedPermissions${objectType}`)}
      </div>
      {showPropagationSetting ? (
        <div className="mb-3 flex flex-row gap-3">
          <div className="font-bold">{t('manage.sharing.minimumRequired')}</div>
          <Switch
            size="sm"
            checked={propagation}
            onCheckedChange={(newValue) => setPropagation(newValue)}
          />
          <div className="font-bold">
            {t('manage.sharing.propagationOfPermissions')}
          </div>
        </div>
      ) : null}
      <table className="w-full border-collapse overflow-hidden rounded-lg border-b shadow-sm">
        <thead>
          <tr className="bg-gray-50">
            {[
              t('shared.generic.object'),
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
          {propagatedPermissions.map(({ object, permissions }) => (
            <tr
              key={object}
              className="border-t border-gray-200 hover:bg-gray-50"
            >
              <td className="px-4 py-3 text-sm font-bold text-gray-900">
                {object}
              </td>
              {permissions.map((permissionLevel, index) => (
                <td
                  key={permissionColumns[index]}
                  className={twMerge(
                    'px-4 py-3 text-center text-sm',
                    index + 1 === activeColumnIndex ? 'bg-blue-50' : ''
                  )}
                >
                  {typeof permissionLevel === 'undefined'
                    ? t(`manage.sharing.noAccess`)
                    : t(`manage.sharing.permissions${permissionLevel}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default PropagatedPermissionsTable
