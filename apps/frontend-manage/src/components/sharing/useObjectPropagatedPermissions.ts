import {
  PermissionLevel,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useObjectPropagatedPermissions({
  objectType,
}: {
  objectType: SharingObjectType
}): { object: string; permissions: (PermissionLevel | undefined)[] }[] | null {
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
  } else if (objectType === SharingObjectType.LiveQuiz) {
    return [
      {
        object: t('shared.types.ELEMENT'),
        permissions: [
          undefined,
          undefined,
          undefined,
          PermissionLevel.Admin,
          PermissionLevel.Admin,
        ],
      },
      {
        object: t('shared.types.ANSWER_COLLECTION'),
        permissions: [
          undefined,
          undefined,
          undefined,
          PermissionLevel.Read,
          PermissionLevel.Read,
        ],
      },
    ]
  }

  return []
}

export default useObjectPropagatedPermissions
