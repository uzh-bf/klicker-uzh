import { describe, expect, it } from 'vitest'
import {
  LecturerMcpAuthorizationError,
  acceptedPermissionLevels,
  hasMinimumPermission,
  requireDerivedPermission,
} from '../src/authorization.js'

describe('lecturer MCP authorization', () => {
  it('matches Manage permission hierarchy', () => {
    expect(acceptedPermissionLevels('READ')).toEqual([
      'READ',
      'EXECUTE',
      'WRITE',
      'ADMIN',
      'OWNER',
    ])
    expect(acceptedPermissionLevels('WRITE')).toEqual([
      'WRITE',
      'ADMIN',
      'OWNER',
    ])
    expect(hasMinimumPermission('EXECUTE', 'WRITE')).toBe(false)
    expect(hasMinimumPermission('WRITE', 'EXECUTE')).toBe(true)
  })

  it('allows owners and directly shared users at sufficient levels', () => {
    expect(
      requireDerivedPermission({
        permission: { permissionLevel: 'OWNER', userId: 'lecturer-owner' },
        requiredPermissionLevel: 'ADMIN',
        userId: 'lecturer-owner',
      })
    ).toMatchObject({ permissionLevel: 'OWNER' })

    expect(
      requireDerivedPermission({
        permission: { permissionLevel: 'WRITE', userId: 'lecturer-shared' },
        requiredPermissionLevel: 'READ',
        userId: 'lecturer-shared',
      })
    ).toMatchObject({ permissionLevel: 'WRITE' })
  })

  it('denies lower-level and cross-user access', () => {
    expect(() =>
      requireDerivedPermission({
        permission: { permissionLevel: 'READ', userId: 'lecturer-a' },
        requiredPermissionLevel: 'WRITE',
        userId: 'lecturer-a',
      })
    ).toThrow(LecturerMcpAuthorizationError)

    expect(() =>
      requireDerivedPermission({
        permission: { permissionLevel: 'OWNER', userId: 'lecturer-a' },
        requiredPermissionLevel: 'READ',
        userId: 'lecturer-b',
      })
    ).toThrow(LecturerMcpAuthorizationError)
  })

  it('does not let route context grant access without a derived permission', () => {
    expect(() =>
      requireDerivedPermission({
        permission: null,
        requiredPermissionLevel: 'READ',
        userId: 'lecturer-from-session',
      })
    ).toThrow(LecturerMcpAuthorizationError)
  })
})
