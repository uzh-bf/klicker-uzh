import { PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import PermissionsTable from '../../sharing/PermissionsTable'

function AnswerCollectionPermissionsTable({
  activePermissionLevel,
}: {
  activePermissionLevel?: PermissionLevel
}) {
  const t = useTranslations()

  return (
    <PermissionsTable
      activePermissionLevel={activePermissionLevel}
      actions={[
        {
          action: t('manage.resources.viewUseCollectionContent'),
          permissions: [true, true, true, true],
        },
        {
          action: t('manage.resources.modifyContent'),
          permissions: [false, true, true, true],
        },
        {
          action: t('manage.resources.shareCollection'),
          permissions: [false, false, true, true],
        },
        {
          action: t('manage.resources.modifyCatalogAssignments'),
          permissions: [false, false, true, true],
        },
        {
          action: t('manage.resources.modifyPermissions'),
          permissions: [false, false, true, true],
        },
        {
          action: t('manage.resources.revokeAccess'),
          permissions: [false, false, true, true],
        },
        {
          action: t('manage.resources.deleteCollection'),
          permissions: [false, false, true, true],
        },
        {
          action: t('manage.sharing.transferOwnership'),
          permissions: [false, false, false, true],
        },
      ]}
    />
  )
}

export default AnswerCollectionPermissionsTable
