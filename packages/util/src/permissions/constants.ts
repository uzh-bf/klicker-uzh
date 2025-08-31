/**
 * Constants and types for KlickerUZH permissions:
 * - UserAccessMap: maps user IDs to { maxAccessLevel, parentPermissionId, derived }.
 * - permissionLevelMap: defines numeric ordering for PermissionLevel enums.
 * - inversePermissionLevelMap: maps numeric levels back to PermissionLevel.
 */

import * as DB from '@klicker-uzh/prisma/client'

export type UserAccessMap = {
  [userId: string]: {
    maxAccessLevel: DB.PermissionLevel
    parentPermissionId: number | undefined
    derived: boolean
  }
}

// map to define order of permission levels
export const permissionLevelMap = {
  [DB.PermissionLevel.OWNER]: 5,
  [DB.PermissionLevel.ADMIN]: 4,
  [DB.PermissionLevel.WRITE]: 3,
  [DB.PermissionLevel.EXECUTE]: 2,
  [DB.PermissionLevel.READ]: 1,
  ['NONE']: 0,
}

// inverse map to return permission levels for ordering key values
export const inversePermissionLevelMap: Record<
  number,
  DB.PermissionLevel | undefined
> = {
  0: undefined,
  1: DB.PermissionLevel.READ,
  2: DB.PermissionLevel.EXECUTE,
  3: DB.PermissionLevel.WRITE,
  4: DB.PermissionLevel.ADMIN,
  5: DB.PermissionLevel.OWNER,
}
