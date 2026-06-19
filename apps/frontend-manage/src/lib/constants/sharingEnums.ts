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

export const SharingType = {
  Dependency: 'DEPENDENCY',
  Owned: 'OWNED',
  Shared: 'SHARED',
} as const

export type SharingType = (typeof SharingType)[keyof typeof SharingType]
