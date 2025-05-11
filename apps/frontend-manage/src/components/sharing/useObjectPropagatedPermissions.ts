import {
  PermissionLevel,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useObjectPropagatedPermissions({
  objectType,
  propagation = false,
}: {
  objectType: SharingObjectType
  propagation?: boolean
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
  } else if (
    objectType === SharingObjectType.LiveQuiz ||
    objectType === SharingObjectType.PracticeQuiz ||
    objectType === SharingObjectType.MicroLearning ||
    objectType === SharingObjectType.GroupActivity
  ) {
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
  } else if (objectType === SharingObjectType.Course && propagation === false) {
    return [
      {
        object: t('shared.types.ACTIVITIES'),
        permissions: [
          PermissionLevel.Read,
          PermissionLevel.Execute,
          PermissionLevel.Execute,
          PermissionLevel.Admin,
          PermissionLevel.Admin,
        ],
      },
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
  } else if (objectType === SharingObjectType.Course && propagation) {
    return [
      {
        object: t('shared.types.ACTIVITIES'),
        permissions: [
          PermissionLevel.Read,
          PermissionLevel.Execute,
          PermissionLevel.Write,
          PermissionLevel.Admin,
          PermissionLevel.Admin,
        ],
      },
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
