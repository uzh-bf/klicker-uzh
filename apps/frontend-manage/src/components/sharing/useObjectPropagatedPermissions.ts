import {
  CatalogObjectType,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useObjectPropagatedPermissions({
  objectType,
}: {
  objectType: CatalogObjectType
}): { object: string; permissions: PermissionLevel[] }[] | null {
  const t = useTranslations()

  if (objectType === CatalogObjectType.CatalogCollection) {
    return null
  } else if (objectType === CatalogObjectType.AnswerCollection) {
    return null
  } else if (objectType === CatalogObjectType.Element) {
    return [
      {
        object: t('shared.types.ANSWER_COLLECTION'),
        permissions: [
          PermissionLevel.Read,
          PermissionLevel.Read,
          PermissionLevel.Read,
          PermissionLevel.Read,
        ],
      },
    ]
  }

  return []
}

export default useObjectPropagatedPermissions
