import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useObjectActionPermissions({
  objectType,
}: {
  objectType: CatalogObjectType
}): { action: string; permissions: boolean[] }[] {
  const t = useTranslations()

  if (objectType === CatalogObjectType.CatalogCollection) {
    return [
      {
        action: t('manage.catalog.browseCatalogCollection'),
        permissions: [true, true, true, true],
      },
      {
        action: t('manage.catalog.modifyContent'),
        permissions: [false, true, true, true],
      },
      {
        action: t(`manage.sharing.share${CatalogObjectType.CatalogCollection}`),
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
    ]
  } else if (objectType === CatalogObjectType.AnswerCollection) {
    return [
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
    ]
  }

  return []
}

export default useObjectActionPermissions
