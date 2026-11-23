// Pure rules of the lecture video approval flow: link tokens, what a link
// may do at a given time, recipients from a catalogue snapshot, the consent
// text, and the audit hash chain. Database access lives in
// videoSourceApproval.ts.

import { createHash, randomBytes } from 'node:crypto'
import type {
  CatalogContact,
  CatalogContactRole,
  CatalogModuleSnapshot,
  CatalogSemester,
} from './uzhCourseCatalog.js'

/** A link can approve for this long after the request was sent. */
export const APPROVAL_GRANT_WINDOW_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

// #region Tokens

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

/**
 * A fresh link token. Only the hash is stored; the token exists only in the
 * email, so a database leak cannot be turned into working links.
 */
export function mintApprovalToken(): { token: string; tokenSha256: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenSha256: hashApprovalToken(token) }
}

export function hashApprovalToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Rejects anything that cannot be a minted token before any lookup. */
export function isWellFormedApprovalToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token)
}

// #endregion

// #region Link state

export type ApprovalRequestStatus =
  | 'OPEN'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'REVOKED'

export type ApprovalLinkState =
  /** Waiting for a recipient; this link can approve or decline. */
  | 'AWAITING_APPROVAL'
  /** Nobody approved within the grant window; the link can still decline. */
  | 'GRANT_EXPIRED'
  /** A newer request replaced this one before anyone approved it. */
  | 'SUPERSEDED'
  /** A recipient approved; a Klicker admin has not yet. */
  | 'AWAITING_ADMIN'
  /** Approved by a recipient and an admin; recordings are processed. */
  | 'ACTIVE'
  /** The semester the approval covered is over. */
  | 'ENDED'
  | 'REVOKED'

export interface ApprovalLinkCapabilities {
  state: ApprovalLinkState
  canApprove: boolean
  canRevoke: boolean
}

/**
 * What a recipient's link may do at `now`. Granting is limited to the grant
 * window of an open request. Revoking stays possible for as long as the
 * request is not revoked or superseded, including after the grant window and
 * after the semester: recordings ingested under an approval stay until that
 * approval is revoked or they are removed otherwise.
 */
export function evaluateApprovalLink(
  request: {
    status: ApprovalRequestStatus
    grantExpiresAt: Date
    validUntil: Date | null
  },
  now: Date
): ApprovalLinkCapabilities {
  switch (request.status) {
    case 'OPEN': {
      const withinWindow = now.getTime() < request.grantExpiresAt.getTime()
      return {
        state: withinWindow ? 'AWAITING_APPROVAL' : 'GRANT_EXPIRED',
        canApprove: withinWindow,
        canRevoke: true,
      }
    }
    case 'APPROVED':
      return { state: 'AWAITING_ADMIN', canApprove: false, canRevoke: true }
    case 'ACTIVE': {
      const ended =
        request.validUntil !== null &&
        now.getTime() >= request.validUntil.getTime()
      return {
        state: ended ? 'ENDED' : 'ACTIVE',
        canApprove: false,
        canRevoke: true,
      }
    }
    case 'SUPERSEDED':
      return { state: 'SUPERSEDED', canApprove: false, canRevoke: false }
    case 'REVOKED':
      return { state: 'REVOKED', canApprove: false, canRevoke: false }
  }
}

export function grantExpiryFor(sentAt: Date): Date {
  return new Date(sentAt.getTime() + APPROVAL_GRANT_WINDOW_DAYS * DAY_MS)
}

/**
 * Exclusive end of a catalogue semester: fall semesters (003) end before
 * 1 February, spring semesters (004) before 1 August (UTC).
 */
export function semesterEnd(semester: CatalogSemester): Date {
  const startYear = Number(semester.piqYear)
  return semester.piqSession === '003'
    ? new Date(Date.UTC(startYear + 1, 1, 1))
    : new Date(Date.UTC(startYear + 1, 7, 1))
}

/** Whether the gateway may act for a source at `now`. */
export function isVideoSourceApprovedAt(
  source: {
    status: string
    activeRequestId: string | null
    validUntil: Date | null
  },
  now: Date
): boolean {
  return (
    source.status === 'APPROVED' &&
    source.activeRequestId !== null &&
    source.validUntil !== null &&
    now.getTime() < source.validUntil.getTime()
  )
}

// #endregion

// #region Recipients and identity

export interface ApprovalRecipientDraft {
  name: string
  email: string
  roles: CatalogContactRole[]
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function contactDisplayName(contact: CatalogContact): string {
  return [contact.title, contact.firstName, contact.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
}

/**
 * One recipient per distinct email among the module's responsible persons and
 * lecturers. Contacts without a public email cannot receive a link and are
 * returned separately so the admin sees who is missing.
 */
export function recipientsFromSnapshot(snapshot: CatalogModuleSnapshot): {
  recipients: ApprovalRecipientDraft[]
  withoutEmail: string[]
} {
  const byEmail = new Map<string, ApprovalRecipientDraft>()
  const withoutEmail: string[] = []

  for (const contact of snapshot.contacts) {
    if (!contact.email) {
      withoutEmail.push(contactDisplayName(contact))
      continue
    }
    const key = normalizeEmail(contact.email)
    const existing = byEmail.get(key)
    if (existing) {
      for (const role of contact.roles) {
        if (!existing.roles.includes(role)) existing.roles.push(role)
      }
      continue
    }
    byEmail.set(key, {
      name: contactDisplayName(contact),
      email: contact.email.trim(),
      roles: [...contact.roles],
    })
  }

  // Responsible persons first: they are named first in the email.
  const recipients = [...byEmail.values()].sort(
    (a, b) =>
      Number(b.roles.includes('RESPONSIBLE')) -
      Number(a.roles.includes('RESPONSIBLE'))
  )
  return { recipients, withoutEmail }
}

/**
 * Whether a signed-in account is the person the link was sent to. edu-ID
 * accounts often carry a private address while the catalogue lists the UZH
 * address, so a mismatch is recorded and shown to the admin rather than
 * blocking the decision.
 */
export function identityMatchesRecipient(
  recipientEmail: string,
  accountEmails: Array<string | null | undefined>
): boolean {
  const target = normalizeEmail(recipientEmail)
  return accountEmails.some(
    (email) => typeof email === 'string' && normalizeEmail(email) === target
  )
}

// #endregion

// #region Consent

export const VIDEO_APPROVAL_CONSENT_VERSION = '2026-11-v1'

/**
 * Shown on the approval page and hashed into every decision. Changing the
 * wording requires a new version. Pending legal review (design doc, open
 * question on consent text and languages).
 */
export const VIDEO_APPROVAL_CONSENT_TEXT = [
  'I agree that KlickerUZH processes the edited recordings published in the channel shown above for the semester shown above, so that the course chatbot can answer questions about the lectures.',
  'KlickerUZH takes the slide video and the captions Kaltura created. It does not process the audio track or the camera stream. Frames and captions are analysed by an AI model hosted in the EU. Full videos and transcripts are deleted after processing; the chatbot keeps text excerpts with timestamps.',
  'I can exclude single recordings with the MediaSpace tag ai-skip or on this page. I can revoke this approval at any time with the link from the email, also after it expired; KlickerUZH then stops processing and removes everything it created from these recordings.',
].join('\n\n')

export function consentTextSha256(text = VIDEO_APPROVAL_CONSENT_TEXT): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export function snapshotSha256(snapshot: CatalogModuleSnapshot): string {
  return createHash('sha256').update(canonicalJson(snapshot)).digest('hex')
}

// #endregion

// #region Audit hash chain

export interface AuditEventContent {
  type: string
  sourceId: string | null
  requestId: string | null
  actorUserId: string | null
  actorEmail: string | null
  payload: unknown
  createdAt: Date
}

// Plain UTF-16 code unit order, independent of locale, so audit hashes are
// stable across runtimes.
export function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null)
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

export function auditEventHash(
  prevHash: string | null,
  event: AuditEventContent
): string {
  return createHash('sha256')
    .update(prevHash ?? '')
    .update('\n')
    .update(
      canonicalJson({
        type: event.type,
        sourceId: event.sourceId,
        requestId: event.requestId,
        actorUserId: event.actorUserId,
        actorEmail: event.actorEmail,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      })
    )
    .digest('hex')
}

/**
 * Checks rows ordered by seq. Returns the seq of the first row whose link or
 * hash does not hold, or null when the chain is intact.
 */
export function findAuditChainBreak(
  rows: Array<
    AuditEventContent & { seq: number; prevHash: string | null; hash: string }
  >
): number | null {
  let previous: string | null = null
  for (const row of rows) {
    if (row.prevHash !== previous) return row.seq
    if (auditEventHash(row.prevHash, row) !== row.hash) return row.seq
    previous = row.hash
  }
  return null
}

// #endregion

// #region Email

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function formatApprovalDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zurich',
  }).format(date)
}

// #endregion
