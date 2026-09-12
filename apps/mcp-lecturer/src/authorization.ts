export type LecturerPermissionLevel =
  | 'READ'
  | 'EXECUTE'
  | 'WRITE'
  | 'ADMIN'
  | 'OWNER'

export type LecturerDerivedPermission = {
  permissionLevel: LecturerPermissionLevel
  userId: string
}

export class LecturerMcpAuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'LecturerMcpAuthorizationError'
  }
}

export function acceptedPermissionLevels(
  requiredPermissionLevel: LecturerPermissionLevel
): LecturerPermissionLevel[] {
  switch (requiredPermissionLevel) {
    case 'READ':
      return ['READ', 'EXECUTE', 'WRITE', 'ADMIN', 'OWNER']
    case 'EXECUTE':
      return ['EXECUTE', 'WRITE', 'ADMIN', 'OWNER']
    case 'WRITE':
      return ['WRITE', 'ADMIN', 'OWNER']
    case 'ADMIN':
      return ['ADMIN', 'OWNER']
    case 'OWNER':
      return ['OWNER']
  }
}

export function hasMinimumPermission(
  actualPermissionLevel: LecturerPermissionLevel,
  requiredPermissionLevel: LecturerPermissionLevel
): boolean {
  return acceptedPermissionLevels(requiredPermissionLevel).includes(
    actualPermissionLevel
  )
}

export function requireDerivedPermission({
  permission,
  requiredPermissionLevel,
  userId,
}: {
  permission: LecturerDerivedPermission | null | undefined
  requiredPermissionLevel: LecturerPermissionLevel
  userId: string
}): LecturerDerivedPermission {
  if (
    !permission ||
    permission.userId !== userId ||
    !hasMinimumPermission(permission.permissionLevel, requiredPermissionLevel)
  ) {
    throw new LecturerMcpAuthorizationError()
  }

  return permission
}
