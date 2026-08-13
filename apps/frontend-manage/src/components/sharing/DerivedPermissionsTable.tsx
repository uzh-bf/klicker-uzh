import { faEyeSlash } from '@fortawesome/free-regular-svg-icons'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { DerivedPermissionInfo } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import DerivedPermissionInfoDialog from './DerivedPermissionInfoDialog'

function DerivedPermissionsTable({
  derivedPermissions,
  derivedPermissionsLoading,
  setShowDerivedPermissions,
}: {
  derivedPermissions: DerivedPermissionInfo[]
  derivedPermissionsLoading: boolean
  setShowDerivedPermissions: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [derivedPermissionOriginAlert, setDerivedPermissionOriginAlert] =
    useState<{ open: boolean; permissionId?: number; username?: string }>({
      open: false,
      permissionId: undefined,
      username: undefined,
    })

  return (
    <>
      <div className="flex flex-row items-start justify-between">
        <H3>{t('manage.sharing.derivedPermissions')}</H3>
        <Button
          basic
          onClick={() => setShowDerivedPermissions(false)}
          className={{
            root: 'text-primary-100 hover:text-primary-100 px-3 py-0.5 text-sm',
          }}
          data={{
            cy: 'hide-derived-permissions',
          }}
        >
          <Button.Icon icon={faEyeSlash} />
          <Button.Label>
            {t('manage.sharing.hideDerivedPermissions')}
          </Button.Label>
        </Button>
      </div>
      <div className="mb-3 text-sm">
        {t('manage.sharing.derivedPermissionsDescription')}
      </div>
      <table className="mt-1 w-full border-collapse overflow-hidden rounded-lg border-b shadow-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">
              {t('shared.generic.shortname')} ({t('shared.generic.email')})
            </th>
            <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">
              {t('shared.generic.permissionLevel')}
            </th>
          </tr>
        </thead>

        <tbody>
          {derivedPermissionsLoading ? (
            <tr>
              <td colSpan={2} className="py-4 text-center">
                <Loader />
              </td>
            </tr>
          ) : derivedPermissions.length === 0 ? (
            <tr>
              <td
                colSpan={2}
                className="py-2 text-center text-sm italic text-gray-500"
              >
                {t('manage.sharing.noDerivedPermissions')}
              </td>
            </tr>
          ) : (
            derivedPermissions.map((permission) => (
              <tr
                key={permission.permissionId}
                className="border-t border-gray-200 hover:bg-gray-50"
                data-cy={`derived-permission-${permission.username}`}
              >
                <td className="px-4 py-1.5 text-sm text-gray-900">
                  <div>
                    {permission.username
                      ? `${permission.username} (${permission.userEmail})${
                          permission.isOwn
                            ? ' ' + t('manage.sharing.ownAccess')
                            : ''
                        }`
                      : '-'}
                  </div>
                  <button
                    type="button"
                    className="text-primary-100 flex cursor-pointer flex-row items-center gap-1.5 border-0 bg-transparent p-0 hover:underline"
                    onClick={() => {
                      setDerivedPermissionOriginAlert({
                        open: true,
                        permissionId: permission.permissionId,
                        username: permission.username,
                      })
                    }}
                  >
                    <FontAwesomeIcon icon={faArrowRight} />
                    <span>
                      {t('manage.sharing.whereDoesThisPermissionOriginate')}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-1.5 text-sm text-gray-900">
                  {t(`manage.sharing.permissions${permission.permissionLevel}`)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <DerivedPermissionInfoDialog
        derivedPermissionOriginAlert={derivedPermissionOriginAlert}
        setDerivedPermissionOriginAlert={setDerivedPermissionOriginAlert}
      />
    </>
  )
}

export default DerivedPermissionsTable
