import { verifyJWT } from '@klicker-uzh/util'
import { cookies } from 'next/headers'

// The Manage assistant serves the lecturer-facing roles: 'USER', plus
// 'ADMIN' as its superset — the backend role lattice treats ADMIN as
// satisfying every USER gate (packages/graphql/src/builder.ts), so admins
// can use the whole Manage app and must not lose the assistant.
// Participant sessions live under a different cookie name
// (`next-auth.participant-session-token`, see apps/auth) and carry role
// 'PARTICIPANT'/'TEMPORARY_PARTICIPANT', so rejecting them here should
// never trigger in practice — it is a defense-in-depth check against any
// token that ends up under the manage cookie name, since both cookies are
// signed with the same APP_SECRET.
const MANAGE_ROLES = new Set(['USER', 'ADMIN'] as const)
type ManageRole = 'USER' | 'ADMIN'

export interface AuthenticatedManageUser {
  role: ManageRole
  // The lecturer's `UserLoginScope` (ACCOUNT_OWNER, FULL_ACCESS,
  // SESSION_EXEC, READ_ONLY, OTP, ...). `undefined` for sessions minted
  // before scope was added to the token — callers must treat a missing
  // scope as least-privilege, not as full access.
  scope: string | undefined
  sub: string
}

/**
 * Verifies the `next-auth.session-token` cookie (the lecturer/Manage
 * session, signed with APP_SECRET) and returns the subject id, role, and
 * `UserLoginScope` carried by the session. Returns null for a missing or
 * invalid token, or for any session whose role is not a Manage-serving
 * role (USER, or ADMIN as its backend-lattice superset).
 */
export async function getAuthenticatedManageUser(): Promise<AuthenticatedManageUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('next-auth.session-token')?.value
  if (!token || !process.env.APP_SECRET) return null

  try {
    const payload = await verifyJWT(token, process.env.APP_SECRET)
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    if (
      typeof payload.role !== 'string' ||
      !MANAGE_ROLES.has(payload.role as ManageRole)
    ) {
      return null
    }

    return {
      role: payload.role as ManageRole,
      scope: typeof payload.scope === 'string' ? payload.scope : undefined,
      sub: payload.sub,
    }
  } catch {
    return null
  }
}

/**
 * @deprecated Prefer `getAuthenticatedManageUser`, which also carries the
 * session's role and scope. Retained as a thin wrapper because
 * `apps/chat/src/app/manage/page.tsx` only needs the subject id and lives
 * outside this module's callers list of interest for scope enforcement.
 */
export async function getAuthenticatedManageUserId(): Promise<string | null> {
  const user = await getAuthenticatedManageUser()
  return user?.sub ?? null
}
