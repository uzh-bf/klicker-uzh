// Lecturer approval of lecture video sources: an admin requests approval for
// one source and period, every listed directory contact gets a personal
// link, one recipient approves through it (edu-ID sign-in), and an admin gives
// final approval. The same link can revoke the approval for as long as it
// exists. Every step is written to the hash-chained KBVideoAuditEvent log.

import { createHash, timingSafeEqual } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  CourseSourcesError,
  type CourseSourcesProvider,
  courseSourcesConfigured,
  createCourseSourcesClient,
} from './courseSources.js'
import * as EmailService from './email.js'
import {
  type ApprovalLinkCapabilities,
  type ApprovalRecipientDraft,
  auditEventHash,
  consentTextSha256,
  escapeHtml,
  evaluateApprovalLink,
  formatApprovalDate,
  grantExpiryFor,
  hashApprovalToken,
  identityMatchesRecipient,
  isVideoSourceApprovedAt,
  isWellFormedApprovalToken,
  mintApprovalToken,
  normalizeEmail,
  snapshotSha256,
  VIDEO_APPROVAL_CONSENT_TEXT,
  VIDEO_APPROVAL_CONSENT_VERSION,
} from './videoSourceApprovalCore.js'

type Tx = Omit<
  DB.PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// Serializes audit appends so each row links to the true previous row.
const AUDIT_LOCK_KEY = 0x6b76_6175 // 'kvau'

function eduIdProviderId() {
  return process.env.NEXT_PUBLIC_EDUID_ID || 'eduid'
}

// Local and test stacks sign in with delegated logins, which have no edu-ID.
function requiresEduId() {
  return process.env.VIDEO_APPROVAL_ALLOW_NON_EDUID !== 'true'
}

function manageUrl() {
  const url = process.env.NEXT_PUBLIC_MANAGE_URL
  if (!url) throw new GraphQLError('NEXT_PUBLIC_MANAGE_URL is not configured')
  return url.replace(/\/$/, '')
}

export function approvalLinkUrl(token: string) {
  return `${manageUrl()}/video-approval?token=${encodeURIComponent(token)}`
}

function linkError() {
  // Same answer for unknown and malformed tokens: nothing about which
  // courses exist leaks to someone guessing links.
  return new GraphQLError('This approval link is not valid.', {
    extensions: { code: 'VIDEO_APPROVAL_LINK_INVALID' },
  })
}

export async function appendVideoAuditEvent(
  tx: Tx,
  event: {
    type: string
    sourceId?: string | null
    requestId?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
    payload?: Record<string, unknown>
  }
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`
  const last = await tx.kBVideoAuditEvent.findFirst({
    orderBy: { seq: 'desc' },
    select: { hash: true },
  })
  const content = {
    type: event.type,
    sourceId: event.sourceId ?? null,
    requestId: event.requestId ?? null,
    actorUserId: event.actorUserId ?? null,
    actorEmail: event.actorEmail ?? null,
    payload: event.payload ?? {},
    // Millisecond precision matches the TIMESTAMP(3) column, so the stored
    // value re-hashes to the same digest.
    createdAt: new Date(Math.floor(Date.now())),
  }
  const prevHash = last?.hash ?? null
  return tx.kBVideoAuditEvent.create({
    data: {
      ...content,
      payload: content.payload as DB.Prisma.InputJsonValue,
      prevHash,
      hash: auditEventHash(prevHash, content),
    },
  })
}

async function loadActor(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    select: {
      id: true,
      email: true,
      name: true,
      shortname: true,
      accounts: {
        where: { provider: eduIdProviderId() },
        select: { providerAccountId: true },
      },
    },
  })
  if (!user) throw new GraphQLError('User not found')
  return {
    id: user.id,
    email: user.email,
    displayName: user.name?.trim() || user.shortname,
    eduIdSubject: user.accounts[0]?.providerAccountId ?? null,
  }
}

// #region Admin: sources and requests

/** The configured provider, or null when admins enter the details by hand. */
function defaultProvider(): CourseSourcesProvider | null {
  return courseSourcesConfigured() ? createCourseSourcesClient() : null
}

function assertHttpUrl(value: string, label: string) {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new GraphQLError(`The ${label} is not a valid link`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new GraphQLError(`The ${label} is not a valid link`)
  }
}

export async function createVideoSource(
  args: {
    kbId: string
    name: string
    sourceUrl: string
    directoryUrl: string
    kalturaCategoryId: string
    cutMode: DB.KBVideoCutMode
    namePattern?: string | null
    captionLanguage: string
  },
  ctx: ContextWithUser,
  deps: { provider?: CourseSourcesProvider | null } = {}
) {
  if (args.cutMode === 'EDITED' && !args.namePattern?.trim()) {
    throw new GraphQLError('Cut mode EDITED requires a name pattern')
  }
  if (args.namePattern) {
    try {
      new RegExp(args.namePattern)
    } catch {
      throw new GraphQLError('The name pattern is not a valid expression')
    }
  }
  const kalturaCategoryId = args.kalturaCategoryId.trim()
  if (!/^\d+$/.test(kalturaCategoryId)) {
    throw new GraphQLError('The Kaltura category id must be numeric')
  }
  assertHttpUrl(args.sourceUrl, 'source link')
  assertHttpUrl(args.directoryUrl, 'course directory link')

  // Both links are required: where the recordings are published and the
  // course directory entry whose contacts approve the source. The provider
  // decides what kind of link the source link is.
  const provider =
    deps.provider === undefined ? defaultProvider() : deps.provider
  const link = provider
    ? await provider.sourceLink({ sourceUrl: args.sourceUrl.trim() })
    : { kind: 'MANUAL', externalRef: '', fixedCollectionId: null }
  if (
    link.fixedCollectionId !== null &&
    link.fixedCollectionId !== kalturaCategoryId
  ) {
    throw new GraphQLError(
      'The Kaltura category id does not match the source link'
    )
  }

  return ctx.prisma.$transaction(async (tx) => {
    const kb = await tx.kB.findFirst({
      where: { id: args.kbId, deletedAt: null },
      select: { id: true },
    })
    if (!kb) throw new GraphQLError('Knowledge base not found')

    const source = await tx.kBVideoSource.create({
      data: {
        kbId: args.kbId,
        name: args.name.trim(),
        sourceKind: link.kind,
        externalRef: link.externalRef || null,
        sourceUrl: args.sourceUrl.trim(),
        directoryUrl: args.directoryUrl.trim(),
        kalturaCategoryId,
        categoryConfirmedAt: new Date(),
        categoryConfirmedById: ctx.user.sub,
        cutMode: args.cutMode,
        namePattern: args.namePattern?.trim() || null,
        captionLanguage: args.captionLanguage.trim(),
        createdById: ctx.user.sub,
      },
    })
    await appendVideoAuditEvent(tx, {
      type: 'SOURCE_CONFIGURED',
      sourceId: source.id,
      actorUserId: ctx.user.sub,
      payload: {
        kbId: source.kbId,
        sourceKind: source.sourceKind,
        externalRef: source.externalRef,
        sourceUrl: source.sourceUrl,
        directoryUrl: source.directoryUrl,
        kalturaCategoryId: source.kalturaCategoryId,
        cutMode: source.cutMode,
        namePattern: source.namePattern,
        captionLanguage: source.captionLanguage,
      },
    })
    return source
  })
}

export async function getVideoSources(
  { kbId }: { kbId: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.kBVideoSource.findMany({
    where: { kbId },
    orderBy: { createdAt: 'asc' },
    include: {
      requests: {
        orderBy: { createdAt: 'desc' },
        include: {
          recipients: { orderBy: { createdAt: 'asc' } },
          decisions: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
}

export function videoSourceProviderConfigured() {
  return courseSourcesConfigured()
}

/**
 * Everything an admin needs to add a source from its two links, as the
 * provider resolves it: the link kind, the course directory entry (title,
 * period, who will be asked to approve) and the proposed recording
 * collections. Each half reports its own error so one outage does not hide
 * the other. The provider looks up the recording platform through the
 * Kaltura gateway, which audits each call; Klicker records that an admin
 * asked and for which links.
 */
export async function resolveVideoSource(
  args: { sourceUrl: string; directoryUrl: string; period?: string | null },
  ctx: ContextWithUser,
  deps: {
    provider?: CourseSourcesProvider | null
    audit?: (
      type: string,
      payload: Record<string, unknown>,
      actor: { id: string; email: string }
    ) => Promise<void>
  } = {}
) {
  const provider =
    deps.provider === undefined ? defaultProvider() : deps.provider
  if (!provider) {
    throw new CourseSourcesError(
      'No course sources provider is configured; enter the details by hand',
      'NOT_CONFIGURED',
      null
    )
  }
  const actor = await loadActor(ctx)
  const audit =
    deps.audit ??
    ((type, payload, who) =>
      ctx.prisma.$transaction(async (tx) => {
        await appendVideoAuditEvent(tx, {
          type,
          actorUserId: who.id,
          actorEmail: who.email,
          payload,
        })
      }))
  await audit(
    'KALTURA_LOOKUP_REQUESTED',
    {
      sourceUrl: args.sourceUrl.trim(),
      directoryUrl: args.directoryUrl.trim(),
      period: args.period?.trim() || null,
    },
    actor
  )
  const result = await provider.resolve({
    sourceUrl: args.sourceUrl.trim(),
    directoryUrl: args.directoryUrl.trim(),
    period: args.period?.trim() || null,
    actor: { userId: actor.id, email: actor.email },
  })
  return {
    sourceKind: result.source.kind,
    externalRef: result.source.externalRef || null,
    fixedCollectionId: result.source.fixedCollectionId,
    periodLabel: result.period.label,
    periodStart: result.period.start,
    periodEnd: result.period.end,
    directory: result.directory
      ? {
          canonicalUrl: result.directory.canonicalUrl,
          title: result.directory.title,
          shortName: result.directory.shortName,
          recipients: result.directory.recipients,
          withoutEmail: result.directory.withoutEmail,
          warnings: result.directory.warnings,
        }
      : null,
    directoryError: result.directoryError,
    collections: result.collections,
    collectionsError: result.collectionsError,
  }
}

/** What an admin enters when no provider is configured. */
export interface ManualDirectoryInput {
  courseTitle: string
  courseShortName?: string | null
  periodLabel: string
  periodEnd: Date
}

export async function requestVideoSourceApproval(
  args: {
    sourceId: string
    // Provider period label; the provider picks the current one when omitted.
    period?: string | null
    // Required without a provider; ignored with one.
    manual?: ManualDirectoryInput | null
    // Added on top of the directory contacts, e.g. a co-lecturer missing
    // there. Without a provider these are the only recipients.
    additionalRecipients?: Array<{ name: string; email: string }> | null
    excludedEmails?: string[] | null
    reason?: string | null
  },
  ctx: ContextWithUser,
  deps: { provider?: CourseSourcesProvider | null; now?: () => Date } = {}
) {
  const now = deps.now?.() ?? new Date()
  const actor = await loadActor(ctx)
  const provider =
    deps.provider === undefined ? defaultProvider() : deps.provider

  const source = await ctx.prisma.kBVideoSource.findUnique({
    where: { id: args.sourceId },
    include: { kb: { include: { chatbots: { include: { chatbot: true } } } } },
  })
  if (!source) throw new GraphQLError('Video source not found')

  let directory: {
    periodLabel: string
    periodEnd: Date
    courseTitle: string
    courseShortName: string
    canonicalUrl: string
    recipients: ApprovalRecipientDraft[]
    withoutEmail: string[]
    warnings: string[]
    snapshot: Record<string, unknown>
  }
  if (provider) {
    const resolved = await provider.directory({
      directoryUrl: source.directoryUrl,
      period: args.period?.trim() || null,
    })
    directory = {
      periodLabel: resolved.period.label,
      periodEnd: resolved.period.end,
      courseTitle: resolved.directory.title,
      courseShortName: resolved.directory.shortName,
      canonicalUrl: resolved.directory.canonicalUrl || source.directoryUrl,
      recipients: resolved.directory.recipients,
      withoutEmail: resolved.directory.withoutEmail,
      warnings: resolved.directory.warnings,
      snapshot: resolved.directory.snapshot,
    }
  } else {
    const manual = args.manual
    if (!manual?.courseTitle.trim() || !manual.periodLabel.trim()) {
      throw new GraphQLError(
        'Without a course sources provider, enter the course title, the period and its end'
      )
    }
    if (Number.isNaN(manual.periodEnd.getTime())) {
      throw new GraphQLError('The period end is not a valid date')
    }
    directory = {
      periodLabel: manual.periodLabel.trim(),
      periodEnd: manual.periodEnd,
      courseTitle: manual.courseTitle.trim(),
      courseShortName: manual.courseShortName?.trim() ?? '',
      canonicalUrl: source.directoryUrl,
      recipients: [],
      withoutEmail: [],
      warnings: [],
      snapshot: {
        manual: true,
        courseTitle: manual.courseTitle.trim(),
        courseShortName: manual.courseShortName?.trim() ?? '',
        periodLabel: manual.periodLabel.trim(),
        periodEnd: manual.periodEnd.toISOString(),
      },
    }
  }
  const { periodLabel, periodEnd } = directory
  if (periodEnd.getTime() <= now.getTime()) {
    throw new GraphQLError(`Period ${periodLabel} is already over`)
  }

  const excluded = new Set((args.excludedEmails ?? []).map(normalizeEmail))
  const directoryEmails = new Set(
    directory.recipients.map((r) => normalizeEmail(r.email))
  )
  const added = new Set<string>()
  const recipients = [
    ...directory.recipients
      .filter((r) => !excluded.has(normalizeEmail(r.email)))
      .map((r) => ({
        ...r,
        origin: DB.KBVideoApprovalRecipientOrigin.DIRECTORY,
      })),
    ...(args.additionalRecipients ?? [])
      .filter((r) => {
        const email = normalizeEmail(r.email)
        if (!email || directoryEmails.has(email) || added.has(email)) {
          return false
        }
        added.add(email)
        return true
      })
      .map((r) => ({
        name: r.name.trim(),
        email: r.email.trim(),
        roles: [] as string[],
        origin: DB.KBVideoApprovalRecipientOrigin.ADMIN_ADDED,
      })),
  ]
  if (recipients.length === 0) {
    throw new GraphQLError(
      provider
        ? 'Nobody to ask: the course directory lists no contact with an email address'
        : 'Nobody to ask: add at least one recipient'
    )
  }
  // Overriding the directory needs a reason; without a provider the admin's
  // list is the directory.
  if (
    provider &&
    (excluded.size > 0 || added.size > 0) &&
    !args.reason?.trim()
  ) {
    throw new GraphQLError('Changing the recipients requires a reason')
  }

  const minted = recipients.map((recipient) => ({
    recipient,
    ...mintApprovalToken(),
  }))
  const grantExpiresAt = grantExpiryFor(now)

  const request = await ctx.prisma.$transaction(async (tx) => {
    const current = await tx.kBVideoApprovalRequest.findFirst({
      where: {
        sourceId: source.id,
        periodLabel,
        status: 'ACTIVE',
        validUntil: { gt: now },
      },
      select: { id: true },
    })
    if (current) {
      throw new GraphQLError(
        `This source is already approved for ${periodLabel}; revoke it first to ask again`
      )
    }

    const superseded = await tx.kBVideoApprovalRequest.findMany({
      where: { sourceId: source.id, status: { in: ['OPEN', 'APPROVED'] } },
      select: { id: true },
    })
    if (superseded.length > 0) {
      await tx.kBVideoApprovalRequest.updateMany({
        where: { id: { in: superseded.map((r) => r.id) } },
        data: { status: 'SUPERSEDED', supersededAt: now },
      })
    }

    const created = await tx.kBVideoApprovalRequest.create({
      data: {
        sourceId: source.id,
        periodLabel,
        periodEnd,
        kalturaCategoryId: source.kalturaCategoryId,
        requestedById: actor.id,
        requestedByName: actor.displayName,
        requestedByEmail: actor.email,
        courseTitle: directory.courseTitle,
        courseShortName: directory.courseShortName,
        directoryCanonicalUrl: directory.canonicalUrl,
        directorySnapshot: directory.snapshot as DB.Prisma.InputJsonValue,
        directorySnapshotSha256: snapshotSha256(directory.snapshot),
        consentVersion: VIDEO_APPROVAL_CONSENT_VERSION,
        consentTextSha256: consentTextSha256(),
        grantExpiresAt,
        recipients: {
          create: minted.map(({ recipient, tokenSha256 }) => ({
            name: recipient.name,
            email: recipient.email,
            roles: recipient.roles,
            origin: recipient.origin,
            tokenSha256,
          })),
        },
      },
      include: { recipients: true },
    })

    // An approved source keeps running on its active request until the new
    // one is approved; anything else now waits for this request.
    if (source.status !== 'APPROVED') {
      await tx.kBVideoSource.update({
        where: { id: source.id },
        data: { status: 'PENDING_APPROVAL' },
      })
    }

    await appendVideoAuditEvent(tx, {
      type: 'APPROVAL_REQUESTED',
      sourceId: source.id,
      requestId: created.id,
      actorUserId: actor.id,
      actorEmail: actor.email,
      payload: {
        periodLabel,
        periodEnd: periodEnd.toISOString(),
        kalturaCategoryId: source.kalturaCategoryId,
        directorySource: provider ? 'PROVIDER' : 'MANUAL',
        directorySnapshotSha256: created.directorySnapshotSha256,
        consentVersion: created.consentVersion,
        consentTextSha256: created.consentTextSha256,
        grantExpiresAt: grantExpiresAt.toISOString(),
        recipients: created.recipients.map((r) => ({
          id: r.id,
          email: r.email,
          roles: r.roles,
          origin: r.origin,
        })),
        contactsWithoutEmail: directory.withoutEmail,
        supersededRequestIds: superseded.map((r) => r.id),
        reason: args.reason?.trim() || null,
      },
    })
    return created
  })

  const chatbotNames = source.kb.chatbots.map((b) => b.chatbot.name)
  const sent: string[] = []
  const failed: string[] = []
  for (const { recipient, tokenSha256, token } of minted) {
    const row = request.recipients.find((r) => r.tokenSha256 === tokenSha256)!
    const ok = await sendApprovalRequestEmail({
      to: recipient.email,
      recipientName: recipient.name,
      requesterName: actor.displayName,
      requesterEmail: actor.email,
      courseTitle: directory.courseTitle,
      periodLabel,
      sourceName: source.name,
      chatbotNames,
      grantExpiresAt,
      link: approvalLinkUrl(token),
      ctx,
    })
    if (ok) {
      await ctx.prisma.kBVideoApprovalRecipient.update({
        where: { id: row.id },
        data: { sentAt: new Date() },
      })
      sent.push(recipient.email)
    } else {
      failed.push(recipient.email)
    }
  }

  await ctx.prisma.$transaction((tx) =>
    appendVideoAuditEvent(tx, {
      type: 'APPROVAL_EMAILS_SENT',
      sourceId: source.id,
      requestId: request.id,
      actorUserId: actor.id,
      actorEmail: actor.email,
      payload: { sent, failed },
    })
  )

  return {
    requestId: request.id,
    periodLabel,
    periodEnd,
    grantExpiresAt,
    recipients: request.recipients.map((r) => ({
      name: r.name,
      email: r.email,
      roles: r.roles,
      sent: sent.includes(r.email),
    })),
    contactsWithoutEmail: directory.withoutEmail,
    warnings: directory.warnings,
  }
}

export async function adminApproveVideoSourceRequest(
  { requestId }: { requestId: string },
  ctx: ContextWithUser,
  deps: { now?: () => Date } = {}
) {
  const now = deps.now?.() ?? new Date()
  const actor = await loadActor(ctx)

  return ctx.prisma.$transaction(async (tx) => {
    const request = await tx.kBVideoApprovalRequest.findUnique({
      where: { id: requestId },
      include: { source: true },
    })
    if (!request) throw new GraphQLError('Approval request not found')
    if (request.status !== 'APPROVED') {
      throw new GraphQLError(
        'Only a request a recipient has approved can get final approval'
      )
    }
    if (request.kalturaCategoryId !== request.source.kalturaCategoryId) {
      throw new GraphQLError(
        'The source category changed after the request; request approval again'
      )
    }
    const validUntil = request.periodEnd
    if (validUntil.getTime() <= now.getTime()) {
      throw new GraphQLError(`Period ${request.periodLabel} is already over`)
    }

    const updated = await tx.kBVideoApprovalRequest.updateMany({
      where: { id: request.id, status: 'APPROVED' },
      data: {
        status: 'ACTIVE',
        adminApprovedAt: now,
        adminApprovedById: actor.id,
        validUntil,
      },
    })
    if (updated.count !== 1) {
      throw new GraphQLError('The request changed meanwhile; reload')
    }
    await tx.kBVideoApprovalDecision.create({
      data: {
        requestId: request.id,
        kind: 'ADMIN_APPROVE',
        userId: actor.id,
        userEmail: actor.email,
        eduIdSubject: actor.eduIdSubject,
        identityMatched: true,
      },
    })
    const source = await tx.kBVideoSource.update({
      where: { id: request.sourceId },
      data: { status: 'APPROVED', activeRequestId: request.id, validUntil },
    })
    await appendVideoAuditEvent(tx, {
      type: 'ADMIN_APPROVED',
      sourceId: request.sourceId,
      requestId: request.id,
      actorUserId: actor.id,
      actorEmail: actor.email,
      payload: {
        periodLabel: request.periodLabel,
        kalturaCategoryId: request.kalturaCategoryId,
        validUntil: validUntil.toISOString(),
      },
    })
    return source
  })
}

export async function adminRevokeVideoSource(
  { sourceId, reason }: { sourceId: string; reason: string },
  ctx: ContextWithUser,
  deps: { now?: () => Date } = {}
) {
  if (!reason.trim()) throw new GraphQLError('Revoking requires a reason')
  const now = deps.now?.() ?? new Date()
  const actor = await loadActor(ctx)

  return ctx.prisma.$transaction(async (tx) => {
    const requests = await tx.kBVideoApprovalRequest.findMany({
      where: { sourceId, status: { in: ['OPEN', 'APPROVED', 'ACTIVE'] } },
      select: { id: true },
    })
    for (const request of requests) {
      await revokeRequestInTx(tx, {
        requestId: request.id,
        now,
        decision: {
          kind: 'ADMIN_REVOKE',
          recipientId: null,
          userId: actor.id,
          userEmail: actor.email,
          eduIdSubject: actor.eduIdSubject,
          identityMatched: true,
          reason: reason.trim(),
        },
      })
    }
    return tx.kBVideoSource.update({
      where: { id: sourceId },
      data: { status: 'REVOKED', activeRequestId: null, validUntil: null },
    })
  })
}

// #endregion

// #region Recipient link

const LINK_INCLUDE = {
  request: {
    include: {
      source: {
        include: {
          kb: { include: { chatbots: { include: { chatbot: true } } } },
        },
      },
      recipients: { select: { name: true, roles: true } },
      decisions: { orderBy: { createdAt: 'asc' as const } },
    },
  },
} satisfies DB.Prisma.KBVideoApprovalRecipientInclude

/**
 * Finds the recipient a link was sent to. A link from a superseded request
 * forwards to the same person's place in the newest request of the source, so
 * an old email can still revoke what that person approved later. It can never
 * approve: `canApprove` is false for forwarded links.
 */
async function resolveLink(token: unknown, ctx: ContextWithUser) {
  if (!isWellFormedApprovalToken(token)) throw linkError()
  const recipient = await ctx.prisma.kBVideoApprovalRecipient.findUnique({
    where: { tokenSha256: hashApprovalToken(token) },
    include: LINK_INCLUDE,
  })
  if (!recipient) throw linkError()
  if (recipient.request.status !== 'SUPERSEDED') {
    return { ...recipient, forwarded: false }
  }
  const newer = await ctx.prisma.kBVideoApprovalRecipient.findFirst({
    where: {
      email: { equals: recipient.email, mode: 'insensitive' },
      request: {
        sourceId: recipient.request.sourceId,
        createdAt: { gt: recipient.request.createdAt },
      },
    },
    orderBy: { request: { createdAt: 'desc' } },
    include: LINK_INCLUDE,
  })
  return newer
    ? { ...newer, forwarded: true }
    : { ...recipient, forwarded: false }
}

function linkCapabilities(
  recipient: Awaited<ReturnType<typeof resolveLink>>,
  now: Date
): ApprovalLinkCapabilities {
  const capabilities = evaluateApprovalLink(recipient.request, now)
  return recipient.forwarded
    ? { ...capabilities, canApprove: false }
    : capabilities
}

export interface VideoApprovalLinkView extends ApprovalLinkCapabilities {
  requestId: string
  periodLabel: string
  requestedAt: Date
  requestedByName: string
  requestedByEmail: string
  grantExpiresAt: Date
  validUntil: Date | null
  recipientName: string
  recipientEmail: string
  signedInEmail: string
  identityMatched: boolean
  eduIdSignedIn: boolean
  eduIdRequired: boolean
  courseTitle: string
  courseShortName: string
  directoryUrl: string
  responsibleNames: string[]
  sourceName: string
  sourceUrl: string
  kalturaCategoryId: string
  cutMode: DB.KBVideoCutMode
  chatbotNames: string[]
  consentVersion: string
  consentText: string
  decidedByName: string | null
  decidedAt: Date | null
}

export async function getVideoApprovalLink(
  { token }: { token: string },
  ctx: ContextWithUser,
  deps: { now?: () => Date } = {}
): Promise<VideoApprovalLinkView> {
  const now = deps.now?.() ?? new Date()
  const recipient = await resolveLink(token, ctx)
  const actor = await loadActor(ctx)
  const { request } = recipient
  if (!recipient.firstOpenedAt) {
    await ctx.prisma.$transaction(async (tx) => {
      const marked = await tx.kBVideoApprovalRecipient.updateMany({
        where: { id: recipient.id, firstOpenedAt: null },
        data: { firstOpenedAt: now },
      })
      if (marked.count === 1) {
        await appendVideoAuditEvent(tx, {
          type: 'APPROVAL_LINK_OPENED',
          sourceId: request.sourceId,
          requestId: request.id,
          actorUserId: actor.id,
          actorEmail: actor.email,
          payload: { recipientId: recipient.id },
        })
      }
    })
  }

  const recipientDecisions = request.decisions.filter(
    (d) => d.kind === 'APPROVE' || d.kind === 'REVOKE'
  )
  const lastRecipientDecision =
    recipientDecisions[recipientDecisions.length - 1]
  const decider = lastRecipientDecision?.recipientId
    ? await ctx.prisma.kBVideoApprovalRecipient.findUnique({
        where: { id: lastRecipientDecision.recipientId },
        select: { name: true },
      })
    : null

  return {
    ...linkCapabilities(recipient, now),
    requestId: request.id,
    periodLabel: request.periodLabel,
    requestedAt: request.createdAt,
    requestedByName: request.requestedByName,
    requestedByEmail: request.requestedByEmail,
    grantExpiresAt: request.grantExpiresAt,
    validUntil: request.validUntil,
    recipientName: recipient.name,
    recipientEmail: recipient.email,
    signedInEmail: actor.email,
    identityMatched: identityMatchesRecipient(recipient.email, [actor.email]),
    eduIdSignedIn: actor.eduIdSubject !== null,
    eduIdRequired: requiresEduId(),
    courseTitle: request.courseTitle,
    courseShortName: request.courseShortName,
    directoryUrl: request.directoryCanonicalUrl,
    responsibleNames: request.recipients
      .filter((r) => r.roles.includes('RESPONSIBLE'))
      .map((r) => r.name),
    sourceName: request.source.name,
    sourceUrl: request.source.sourceUrl,
    kalturaCategoryId: request.kalturaCategoryId,
    cutMode: request.source.cutMode,
    chatbotNames: request.source.kb.chatbots.map((b) => b.chatbot.name),
    consentVersion: VIDEO_APPROVAL_CONSENT_VERSION,
    consentText: VIDEO_APPROVAL_CONSENT_TEXT,
    decidedByName: decider?.name ?? null,
    decidedAt: lastRecipientDecision?.createdAt ?? null,
  }
}

function assertEduId(actor: { eduIdSubject: string | null }) {
  if (requiresEduId() && !actor.eduIdSubject) {
    throw new GraphQLError('Sign in with edu-ID to decide on this request.', {
      extensions: { code: 'VIDEO_APPROVAL_EDUID_REQUIRED' },
    })
  }
}

export async function approveVideoSourceByLink(
  { token, consentVersion }: { token: string; consentVersion: string },
  ctx: ContextWithUser,
  deps: { now?: () => Date } = {}
) {
  const now = deps.now?.() ?? new Date()
  const recipient = await resolveLink(token, ctx)
  const actor = await loadActor(ctx)
  assertEduId(actor)

  if (consentVersion !== VIDEO_APPROVAL_CONSENT_VERSION) {
    throw new GraphQLError(
      'The consent text changed; reload the page and read it again'
    )
  }
  const { request } = recipient
  if (!linkCapabilities(recipient, now).canApprove) {
    throw new GraphQLError('This link can no longer approve.', {
      extensions: { code: 'VIDEO_APPROVAL_GRANT_CLOSED' },
    })
  }
  const identityMatched = identityMatchesRecipient(recipient.email, [
    actor.email,
  ])

  await ctx.prisma.$transaction(async (tx) => {
    const updated = await tx.kBVideoApprovalRequest.updateMany({
      where: { id: request.id, status: 'OPEN', grantExpiresAt: { gt: now } },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        approvedByRecipientId: recipient.id,
      },
    })
    if (updated.count !== 1) {
      throw new GraphQLError('This link can no longer approve.', {
        extensions: { code: 'VIDEO_APPROVAL_GRANT_CLOSED' },
      })
    }
    await tx.kBVideoApprovalDecision.create({
      data: {
        requestId: request.id,
        recipientId: recipient.id,
        kind: 'APPROVE',
        userId: actor.id,
        userEmail: actor.email,
        eduIdSubject: actor.eduIdSubject,
        identityMatched,
        consentVersion: VIDEO_APPROVAL_CONSENT_VERSION,
        consentTextSha256: consentTextSha256(),
      },
    })
    if (request.source.status !== 'APPROVED') {
      await tx.kBVideoSource.update({
        where: { id: request.sourceId },
        data: { status: 'AWAITING_ADMIN' },
      })
    }
    await appendVideoAuditEvent(tx, {
      type: 'APPROVAL_GRANTED',
      sourceId: request.sourceId,
      requestId: request.id,
      actorUserId: actor.id,
      actorEmail: actor.email,
      payload: {
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        eduIdSubject: actor.eduIdSubject,
        identityMatched,
        consentVersion: VIDEO_APPROVAL_CONSENT_VERSION,
        consentTextSha256: consentTextSha256(),
      },
    })
  })

  // Tell the other recipients; their links can still revoke.
  const others = await ctx.prisma.kBVideoApprovalRecipient.findMany({
    where: { requestId: request.id, id: { not: recipient.id } },
  })
  for (const other of others) {
    await sendApprovalGrantedNotice({
      to: other.email,
      recipientName: other.name,
      approverName: recipient.name,
      courseTitle: request.courseTitle,
      periodLabel: request.periodLabel,
      sourceName: request.source.name,
      ctx,
    })
  }

  return getVideoApprovalLink({ token }, ctx, deps)
}

export async function revokeVideoSourceByLink(
  { token, reason }: { token: string; reason?: string | null },
  ctx: ContextWithUser,
  deps: { now?: () => Date } = {}
) {
  const now = deps.now?.() ?? new Date()
  const recipient = await resolveLink(token, ctx)
  const actor = await loadActor(ctx)
  assertEduId(actor)

  const { request } = recipient
  if (!linkCapabilities(recipient, now).canRevoke) {
    throw new GraphQLError('There is nothing left to revoke with this link.')
  }

  await ctx.prisma.$transaction((tx) =>
    revokeRequestInTx(tx, {
      requestId: request.id,
      now,
      decision: {
        kind: 'REVOKE',
        recipientId: recipient.id,
        userId: actor.id,
        userEmail: actor.email,
        eduIdSubject: actor.eduIdSubject,
        identityMatched: identityMatchesRecipient(recipient.email, [
          actor.email,
        ]),
        reason: reason?.trim() || null,
      },
    })
  )

  return getVideoApprovalLink({ token }, ctx, deps)
}

/**
 * Revokes one request. If it is the one the source currently runs on (or the
 * one it waits for), the source stops at once: the gateway checks the source
 * before every Kaltura call. Recordings ingested under the request are
 * removed by the discovery worker, which acts on REVOCATION_PURGE_REQUESTED.
 */
async function revokeRequestInTx(
  tx: Tx,
  {
    requestId,
    now,
    decision,
  }: {
    requestId: string
    now: Date
    decision: {
      kind: 'REVOKE' | 'ADMIN_REVOKE'
      recipientId: string | null
      userId: string
      userEmail: string
      eduIdSubject: string | null
      identityMatched: boolean
      reason: string | null
    }
  }
) {
  const request = await tx.kBVideoApprovalRequest.findUnique({
    where: { id: requestId },
    include: { source: true },
  })
  if (!request) throw new GraphQLError('Approval request not found')

  const updated = await tx.kBVideoApprovalRequest.updateMany({
    where: { id: requestId, status: { in: ['OPEN', 'APPROVED', 'ACTIVE'] } },
    data: { status: 'REVOKED', revokedAt: now },
  })
  if (updated.count !== 1) {
    throw new GraphQLError('There is nothing left to revoke with this link.')
  }
  await tx.kBVideoApprovalDecision.create({
    data: { requestId, ...decision },
  })

  const sourceRunsOnRequest = request.source.activeRequestId === requestId
  const sourceWaitsForRequest =
    request.source.status === 'PENDING_APPROVAL' ||
    request.source.status === 'AWAITING_ADMIN'
  if (sourceRunsOnRequest || sourceWaitsForRequest) {
    await tx.kBVideoSource.update({
      where: { id: request.sourceId },
      data: sourceRunsOnRequest
        ? { status: 'REVOKED', activeRequestId: null, validUntil: null }
        : { status: 'REVOKED' },
    })
  }

  await appendVideoAuditEvent(tx, {
    type: decision.kind === 'REVOKE' ? 'APPROVAL_REVOKED' : 'ADMIN_REVOKED',
    sourceId: request.sourceId,
    requestId,
    actorUserId: decision.userId,
    actorEmail: decision.userEmail,
    payload: {
      recipientId: decision.recipientId,
      eduIdSubject: decision.eduIdSubject,
      identityMatched: decision.identityMatched,
      reason: decision.reason,
      previousStatus: request.status,
      sourceStopped: sourceRunsOnRequest || sourceWaitsForRequest,
    },
  })
  if (request.status === 'ACTIVE') {
    await appendVideoAuditEvent(tx, {
      type: 'REVOCATION_PURGE_REQUESTED',
      sourceId: request.sourceId,
      requestId,
      actorUserId: decision.userId,
      actorEmail: decision.userEmail,
      payload: { scope: 'ALL_RECORDINGS_INGESTED_UNDER_REQUEST' },
    })
  }
}

// #endregion

// #region Emails

async function sendApprovalRequestEmail(args: {
  to: string
  recipientName: string
  requesterName: string
  requesterEmail: string
  courseTitle: string
  periodLabel: string
  sourceName: string
  chatbotNames: string[]
  grantExpiresAt: Date
  link: string
  ctx: ContextWithUser
}) {
  const chatbots = args.chatbotNames.join(', ') || 'the course chatbot'
  const expires = formatApprovalDate(args.grantExpiresAt)
  const variables = {
    RECIPIENT_NAME: args.recipientName,
    REQUESTER_NAME: args.requesterName,
    REQUESTER_EMAIL: args.requesterEmail,
    COURSE: args.courseTitle,
    PERIOD: args.periodLabel,
    SOURCE: args.sourceName,
    CHATBOTS: chatbots,
    GRANT_EXPIRES: expires,
  }
  const html = await EmailService.hydrateTemplate(
    {
      templateName: 'VideoSourceApprovalRequested',
      variables: {
        ...Object.fromEntries(
          Object.entries(variables).map(([k, v]) => [k, escapeHtml(v)])
        ),
        LINK: escapeHtml(args.link),
      },
    },
    args.ctx.prisma
  )
  if (!html) return false

  return EmailService.sendEmail({
    to: args.to,
    replyTo: args.requesterEmail,
    subject: `Approval requested: lecture recordings of ${args.courseTitle} (${args.periodLabel}) for KlickerUZH`,
    text: [
      `Dear ${args.recipientName}`,
      `${args.requesterName} (${args.requesterEmail}) asks you to approve that KlickerUZH processes the edited lecture recordings of ${args.courseTitle} in ${args.periodLabel} (${args.sourceName}) for ${chatbots}.`,
      `Review and decide here (sign in with edu-ID): ${args.link}`,
      `The link can approve until ${expires}. It can revoke the approval at any time, also after that date.`,
    ].join('\n\n'),
    html,
  })
}

async function sendApprovalGrantedNotice(args: {
  to: string
  recipientName: string
  approverName: string
  courseTitle: string
  periodLabel: string
  sourceName: string
  ctx: ContextWithUser
}) {
  const variables = {
    RECIPIENT_NAME: args.recipientName,
    APPROVER_NAME: args.approverName,
    COURSE: args.courseTitle,
    PERIOD: args.periodLabel,
    SOURCE: args.sourceName,
  }
  const html = await EmailService.hydrateTemplate(
    {
      templateName: 'VideoSourceApprovalGranted',
      variables: Object.fromEntries(
        Object.entries(variables).map(([k, v]) => [k, escapeHtml(v)])
      ),
    },
    args.ctx.prisma
  )
  if (!html) return false
  return EmailService.sendEmail({
    to: args.to,
    subject: `Approved: lecture recordings of ${args.courseTitle} (${args.periodLabel}) for KlickerUZH`,
    text: [
      `Dear ${args.recipientName}`,
      `${args.approverName} approved that KlickerUZH processes the edited lecture recordings of ${args.courseTitle} in ${args.periodLabel} (${args.sourceName}).`,
      'You can still revoke this approval with the link from the original email.',
    ].join('\n\n'),
    html,
  })
}

// #endregion

// #region Gateway scope check

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bearerMatches(authorization: string | undefined, secret: string) {
  const digest = (value: string) =>
    createHash('sha256').update(value, 'utf8').digest()
  return timingSafeEqual(
    digest(`Bearer ${secret}`),
    digest(authorization ?? '')
  )
}

export type VideoSourceScopeResult =
  | { statusCode: 400 | 401 | 503; body: { error: string } }
  | {
      statusCode: 200
      body: {
        source: null | {
          sourceId: string
          status: DB.KBVideoSourceStatus
          activeRequestId: string | null
          validUntil: string | null
          kalturaCategoryId: string
          cutMode: DB.KBVideoCutMode
          namePattern: string | null
          captionLanguage: string
          approved: boolean
        }
      }
    }

/**
 * Read-only scope check for the Kaltura gateway, the only Kaltura token
 * holder. It must call this before every Kaltura call for a source and act
 * only when `approved` holds (isVideoSourceApprovedAt). Answers from the
 * database without caching and audits each read as SCOPE_READ.
 */
export async function handleVideoSourceScope({
  prisma,
  body,
  authorization,
  env = process.env,
  now = () => new Date(),
}: {
  prisma: DB.PrismaClient
  body: unknown
  authorization?: string
  env?: NodeJS.ProcessEnv
  now?: () => Date
}): Promise<VideoSourceScopeResult> {
  const secret = env.VIDEO_SOURCE_SCOPE_TOKEN?.trim()
  if (!secret) {
    return { statusCode: 503, body: { error: 'Service unavailable' } }
  }
  if (!bearerMatches(authorization, secret)) {
    return { statusCode: 401, body: { error: 'Unauthorized' } }
  }
  const sourceId =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>).sourceId
      : undefined
  if (typeof sourceId !== 'string' || !UUID_PATTERN.test(sourceId)) {
    return { statusCode: 400, body: { error: 'Invalid sourceId' } }
  }

  return prisma.$transaction(async (tx) => {
    const source = await tx.kBVideoSource.findUnique({
      where: { id: sourceId },
    })
    const at = now()
    const approved = source ? isVideoSourceApprovedAt(source, at) : false
    await appendVideoAuditEvent(tx, {
      type: 'SCOPE_READ',
      sourceId: source?.id ?? null,
      requestId: source?.activeRequestId ?? null,
      payload: {
        requestedSourceId: sourceId,
        found: Boolean(source),
        status: source?.status ?? null,
        validUntil: source?.validUntil?.toISOString() ?? null,
        approved,
        checkedAt: at.toISOString(),
      },
    })
    return {
      statusCode: 200 as const,
      body: {
        source: source
          ? {
              sourceId: source.id,
              status: source.status,
              activeRequestId: source.activeRequestId,
              validUntil: source.validUntil?.toISOString() ?? null,
              kalturaCategoryId: source.kalturaCategoryId,
              cutMode: source.cutMode,
              namePattern: source.namePattern,
              captionLanguage: source.captionLanguage,
              approved,
            }
          : null,
      },
    }
  })
}

// #endregion
