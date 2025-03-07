import { faPeopleArrows } from '@fortawesome/free-solid-svg-icons'
import {
  CatalogObjectType,
  PermissionInfo,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import DirectSharingForm from './DirectSharingForm'
import ExistingPermissionEntries from './ExistingPermissionEntries'

function GrantedPermissionsTable({
  type,
  permissions,
  permissionsLoading,
  changeLoading,
  isOwner,
  onPermissionLevelChange,
  onPermissionRemoval,
  onNewPermissionSuccess,
  onNewPermissionFailure,
  onOwnershipTransfer,
  shareObjectCallback,
}: {
  type: CatalogObjectType
  permissions: PermissionInfo[]
  permissionsLoading: boolean
  changeLoading: boolean
  isOwner: boolean
  onPermissionLevelChange: ({
    permissionId,
    newPermissionLevel,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
  }) => Promise<void>
  onPermissionRemoval: (permissionId: number) => Promise<void>
  onNewPermissionSuccess: () => void
  onNewPermissionFailure: () => void
  onOwnershipTransfer: () => void
  shareObjectCallback: ({
    usernameOrEmail,
    userGroupId,
    permissionLevel,
  }: {
    usernameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
  }) => Promise<boolean>
}) {
  const t = useTranslations()

  return (
    <>
      <div className="flex flex-row justify-between">
        <H3>{t('manage.sharing.grantedPermissions')}</H3>
        {isOwner && (
          <Button
            basic
            onClick={() => onOwnershipTransfer()}
            className={{
              root: 'h-7 rounded border px-2 py-0.5',
            }}
            data={{ cy: 'transfer-ownership' }}
          >
            <Button.Icon icon={faPeopleArrows} />
            <Button.Label>{t('manage.sharing.transferOwnership')}</Button.Label>
          </Button>
        )}
      </div>
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
              {t('shared.generic.permissionLevel')}
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
                onPermissionLevelChange={onPermissionLevelChange}
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
