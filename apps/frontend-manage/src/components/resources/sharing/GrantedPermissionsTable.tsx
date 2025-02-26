import {
  AccessLevel,
  CatalogObjectType,
  PermissionInfo,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import DirectSharingForm from '../sharing/DirectSharingForm'
import ExistingPermissionEntries from '../sharing/ExistingPermissionEntries'

function GrantedPermissionsTable({
  type,
  permissions,
  permissionsLoading,
  changeLoading,
  onAccessLevelChange,
  onPermissionRemoval,
  onNewPermissionSuccess,
  onNewPermissionFailure,
  shareObjectCallback,
}: {
  type: CatalogObjectType
  permissions: PermissionInfo[]
  permissionsLoading: boolean
  changeLoading: boolean
  onAccessLevelChange: ({
    permissionId,
    newAccessLevel,
  }: {
    permissionId: number
    newAccessLevel: AccessLevel
  }) => Promise<void>
  onPermissionRemoval: (permissionId: number) => Promise<void>
  onNewPermissionSuccess: () => void
  onNewPermissionFailure: () => void
  shareObjectCallback: ({
    usernameOrEmail,
    userGroupId,
    accessLevel,
  }: {
    usernameOrEmail?: string
    userGroupId?: number
    accessLevel: AccessLevel
  }) => Promise<boolean>
}) {
  const t = useTranslations()

  return (
    <>
      <H3>{t('manage.resources.grantedPermissions')}</H3>
      <table className="mt-1 w-full border-collapse overflow-hidden rounded-lg border-b shadow-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
              {t('shared.generic.username')} ({t('shared.generic.email')})
            </th>
            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
              {t('shared.generic.userGroup')}
            </th>
            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
              {t('shared.generic.accessLevel')}
            </th>
            <th className="w-10" />
          </tr>
        </thead>

        <tbody>
          {permissionsLoading ? (
            <tr>
              <td colSpan={4} className="py-4 text-center">
                <Loader />
              </td>
            </tr>
          ) : (
            <>
              <ExistingPermissionEntries
                type={type}
                permissions={permissions ?? []}
                changeLoading={changeLoading}
                onAccessLevelChange={onAccessLevelChange}
                onPermissionRemoval={onPermissionRemoval}
              />
              <DirectSharingForm
                type={type}
                onSuccess={onNewPermissionSuccess}
                onFailure={onNewPermissionFailure}
                shareObjectCallback={shareObjectCallback}
              />
            </>
          )}
        </tbody>
      </table>
    </>
  )
}

export default GrantedPermissionsTable
