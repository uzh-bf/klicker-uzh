/**
 * Normalize an email: trim, lowercase, and ensure it contains an '@'.
 */
export function normalizeEmail(email?: string): string | null {
  if (!email) return null
  const normalized = email.trim().toLowerCase()
  return normalized.includes('@') ? normalized : null
}

/**
 * For UZH departmental emails (e.g., user@df.uzh.ch or user@it.ifi.uzh.ch),
 * compute the collapsed variant without subdomains: user@uzh.ch.
 * Returns null if email is already @uzh.ch or not under the uzh.ch domain.
 */
export function collapsedUzhVariant(email: string): string | null {
  const [local, domain] = email.split('@')
  if (!local || !domain) return null
  if (domain === 'uzh.ch') return null
  if (domain.endsWith('.uzh.ch')) return `${local}@uzh.ch`
  return null
}

/**
 * Collect all relevant emails for matching invitations:
 * - include primary and affiliation emails
 * - normalize them
 * - add collapsed @uzh.ch variant for departmental addresses
 * - deduplicate
 */
export const InvitationEmailMode = {
  AffiliationsOnly: 'AffiliationsOnly',
  ProfileAndAffiliations: 'ProfileAndAffiliations',
} as const

export type InvitationEmailMode =
  (typeof InvitationEmailMode)[keyof typeof InvitationEmailMode]

export const DEFAULT_INVITATION_EMAIL_MODE: InvitationEmailMode =
  InvitationEmailMode.AffiliationsOnly

export interface CollectedInvitationEmails {
  profileEmails: string[]
  affiliationEmails: string[]
  allEmails: string[]
}

function addEmailToSet(target: Set<string>, email?: string | null) {
  const normalized = normalizeEmail(email ?? undefined)
  if (!normalized) return

  target.add(normalized)

  const collapsed = collapsedUzhVariant(normalized)
  if (collapsed) target.add(collapsed)
}

export function collectInvitationEmails(
  primaryEmail?: string,
  affiliationEmails?: string[]
): CollectedInvitationEmails {
  const profileSet = new Set<string>()
  const affiliationSet = new Set<string>()

  addEmailToSet(profileSet, primaryEmail)

  for (const email of affiliationEmails ?? []) {
    addEmailToSet(affiliationSet, email)
  }

  const combined = new Set<string>([...profileSet, ...affiliationSet])

  return {
    profileEmails: Array.from(profileSet),
    affiliationEmails: Array.from(affiliationSet),
    allEmails: Array.from(combined),
  }
}

export function collectAllEmails(
  primaryEmail?: string,
  affiliationEmails?: string[]
): string[] {
  return collectInvitationEmails(primaryEmail, affiliationEmails).allEmails
}
