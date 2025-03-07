import { PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import PermissionsTable from '../../sharing/PermissionsTable'

function CatalogCollectionPermissionsTable({
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
          action: t('manage.catalog.browseCatalogCollection'),
          permissions: [true, true, true, true],
        },
        {
          action: t('manage.catalog.modifyContent'),
          permissions: [false, true, true, true],
        },
        {
          action: t('manage.catalog.shareCatalogCollection'),
          permissions: [false, false, true, true],
        },
        {
          action: t('manage.catalog.modifyPermissions'),
          permissions: [false, false, true, true],
        },
        {
          action: t('manage.catalog.revokeAccess'),
          permissions: [false, false, true, true],
        },
        {
          action: t('manage.catalog.deleteCollection'),
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

export default CatalogCollectionPermissionsTable
