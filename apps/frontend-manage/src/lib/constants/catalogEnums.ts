import type {
  ObjectType as GraphqlObjectType,
  PermissionLevel as GraphqlPermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'

export const ObjectAccess = {
  Public: 'PUBLIC',
  Restricted: 'RESTRICTED',
} as const

export type ObjectAccess = (typeof ObjectAccess)[keyof typeof ObjectAccess]

export const ObjectType = {
  AnswerCollection: 'ANSWER_COLLECTION',
  CatalogCollection: 'CATALOG_COLLECTION',
  Course: 'COURSE',
  Element: 'ELEMENT',
  GroupActivity: 'GROUP_ACTIVITY',
  LiveQuiz: 'LIVE_QUIZ',
  MicroLearning: 'MICRO_LEARNING',
  PracticeQuiz: 'PRACTICE_QUIZ',
} as const

export type ObjectType = (typeof ObjectType)[keyof typeof ObjectType]

export const PermissionLevel = {
  Admin: 'ADMIN',
  Execute: 'EXECUTE',
  Owner: 'OWNER',
  Read: 'READ',
  Write: 'WRITE',
} as const

export type PermissionLevel =
  (typeof PermissionLevel)[keyof typeof PermissionLevel]

export function toGraphqlObjectType(objectType: ObjectType) {
  return objectType as unknown as GraphqlObjectType
}

export function toGraphqlPermissionLevel(permissionLevel: PermissionLevel) {
  return permissionLevel as unknown as GraphqlPermissionLevel
}
