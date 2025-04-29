import { SharingObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useObjectActionPermissions({
  objectType,
}: {
  objectType: SharingObjectType
}): { action: string; permissions: boolean[] }[] {
  const t = useTranslations()

  if (objectType === SharingObjectType.CatalogCollection) {
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
        action: t(`manage.sharing.share${SharingObjectType.CatalogCollection}`),
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
  } else if (objectType === SharingObjectType.AnswerCollection) {
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
  } else if (objectType === CatalogObjectType.Element) {
    return [
      {
        action: t('manage.elements.viewElement'),
        permissions: [true, true, true, true],
      },
      {
        action: t('manage.elements.DUPLICATETitle'),
        permissions: [true, true, true, true],
      },
      {
        action: t('manage.elements.modifyElement'),
        permissions: [false, true, true, true],
      },
      {
        action: t('manage.elements.useElementInActivities'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.elements.shareElement'),
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
        action: t('manage.elements.deleteElement'),
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
