import { faPeopleArrows } from '@fortawesome/free-solid-svg-icons'
import {
  ObjectType,
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
  showPropagationSetting,
  onPermissionLevelChange,
  onPermissionRemoval,
  onSharingSuccess,
  onSharingFailure,
  onOwnershipTransfer,
  shareObjectCallback,
}: {
  type: ObjectType
  permissions: PermissionInfo[]
  permissionsLoading: boolean
  changeLoading: boolean
  isOwner: boolean
  showPropagationSetting: boolean
  onPermissionLevelChange: ({
    permissionId,
    newPermissionLevel,
    newPropagation,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
    newPropagation: boolean
  }) => Promise<void>
  onPermissionRemoval: (permissionId: number) => Promise<void>
  onSharingSuccess: () => void
  onSharingFailure: () => void
  onOwnershipTransfer: () => void
  shareObjectCallback: ({
    shortnameOrEmail,
    userGroupId,
    permissionLevel,
    propagation,
  }: {
    shortnameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
    propagation: boolean
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
              {t('shared.generic.shortname')} ({t('shared.generic.email')})
            </th>
            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
              {t('shared.generic.userGroup')}
            </th>
            <th className="w-40 px-4 py-3 text-left text-sm font-bold text-gray-700">
              {t('shared.generic.permissionLevel')}
            </th>
            {showPropagationSetting ? (
              <th className="w-24 px-2 text-center text-sm font-bold text-gray-700">
                {t('shared.generic.propagation')}
              </th>
            ) : null}
            <th className="w-10" />
          </tr>
        </thead>

        <tbody>
          {permissionsLoading ? (
            <tr>
              <td
                colSpan={showPropagationSetting ? 5 : 4}
                className="py-4 text-center"
              >
                <Loader />
              </td>
            </tr>
          ) : (
            <>
              <ExistingPermissionEntries
                type={type}
                permissions={permissions ?? []}
                changeLoading={changeLoading}
                showPropagationSetting={showPropagationSetting}
                onPermissionLevelChange={onPermissionLevelChange}
                onPermissionRemoval={onPermissionRemoval}
              />
              <DirectSharingForm
                type={type}
                showPropagationSetting={showPropagationSetting}
                onSuccess={onSharingSuccess}
                onFailure={onSharingFailure}
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
