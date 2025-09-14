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
export function collectAllEmails(
  primaryEmail?: string,
  affiliationEmails?: string[]
): string[] {
  const unique = new Set<string>()
  const inputs = [primaryEmail, ...(affiliationEmails ?? [])]

  for (const input of inputs) {
    const normalized = normalizeEmail(input)
    if (!normalized) continue

    unique.add(normalized)

    const collapsed = collapsedUzhVariant(normalized)
    if (collapsed) unique.add(collapsed)
  }

  return Array.from(unique)
}
