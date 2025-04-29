import {
  PermissionLevel,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useObjectPropagatedPermissions({
  objectType,
}: {
  objectType: SharingObjectType
}): { object: string; permissions: PermissionLevel[] }[] | null {
  const t = useTranslations()

  if (objectType === SharingObjectType.CatalogCollection) {
    return null
  } else if (objectType === SharingObjectType.AnswerCollection) {
    return null
  } else if (objectType === SharingObjectType.Element) {
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
