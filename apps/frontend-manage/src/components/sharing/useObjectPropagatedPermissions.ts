import { ObjectType, PermissionLevel } from '@lib/constants/sharingEnums'
import { useTranslations } from 'next-intl'

function useObjectPropagatedPermissions({
  objectType,
  propagation = false,
}: {
  objectType: ObjectType
  propagation?: boolean
}): { object: string; permissions: (PermissionLevel | undefined)[] }[] | null {
  const t = useTranslations()

  if (objectType === ObjectType.CatalogCollection) {
    return null
  } else if (objectType === ObjectType.AnswerCollection) {
    return null
  } else if (objectType === ObjectType.Element) {
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
    propagation === false &&
    (objectType === ObjectType.LiveQuiz ||
      objectType === ObjectType.PracticeQuiz ||
      objectType === ObjectType.MicroLearning ||
      objectType === ObjectType.GroupActivity)
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
  } else if (
    propagation === true &&
    (objectType === ObjectType.LiveQuiz ||
      objectType === ObjectType.PracticeQuiz ||
      objectType === ObjectType.MicroLearning ||
      objectType === ObjectType.GroupActivity)
  ) {
    return [
      {
        object: t('shared.types.ELEMENT'),
        permissions: [
          PermissionLevel.Read,
          PermissionLevel.Read,
          PermissionLevel.Write,
          PermissionLevel.Admin,
          PermissionLevel.Admin,
        ],
      },
      {
        object: t('shared.types.ANSWER_COLLECTION'),
        permissions: [
          PermissionLevel.Read,
          PermissionLevel.Read,
          PermissionLevel.Read,
          PermissionLevel.Read,
          PermissionLevel.Read,
        ],
      },
    ]
  } else if (objectType === ObjectType.Course && propagation === false) {
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
  } else if (objectType === ObjectType.Course && propagation) {
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
