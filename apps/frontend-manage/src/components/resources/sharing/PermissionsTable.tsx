import {
  faCheckCircle,
  faCircleXmark,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'

function PermissionsTable({
  actions,
}: {
  actions: { action: string; permissions: boolean[] }[]
}) {
  const t = useTranslations()

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
          ].map((title) => (
            <th
              key={title}
              className="px-4 py-3 text-center text-sm font-bold text-gray-700 first:text-left"
            >
              {title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white">
        {actions.map(({ action, permissions }) => (
          <tr
            key={action}
            className="border-t border-gray-200 hover:bg-gray-50"
          >
            <td className="px-4 py-3 text-sm text-gray-900">{action}</td>
            {permissions.map((hasPermission, index) => (
              <td key={index} className="px-4 py-3 text-center">
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
