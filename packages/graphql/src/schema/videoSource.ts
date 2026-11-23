import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type { VideoApprovalLinkView } from '../services/videoSourceApproval.js'

export const KBVideoSourceKind = builder.enumType('KBVideoSourceKind', {
  values: Object.values(DB.KBVideoSourceKind),
})
export const KBVideoCutMode = builder.enumType('KBVideoCutMode', {
  values: Object.values(DB.KBVideoCutMode),
})
export const KBVideoSourceStatus = builder.enumType('KBVideoSourceStatus', {
  values: Object.values(DB.KBVideoSourceStatus),
})
export const KBVideoApprovalRequestStatus = builder.enumType(
  'KBVideoApprovalRequestStatus',
  { values: Object.values(DB.KBVideoApprovalRequestStatus) }
)
export const KBVideoApprovalDecisionKind = builder.enumType(
  'KBVideoApprovalDecisionKind',
  { values: Object.values(DB.KBVideoApprovalDecisionKind) }
)
export const VideoApprovalLinkState = builder.enumType(
  'VideoApprovalLinkState',
  {
    values: [
      'AWAITING_APPROVAL',
      'GRANT_EXPIRED',
      'SUPERSEDED',
      'AWAITING_ADMIN',
      'ACTIVE',
      'ENDED',
      'REVOKED',
    ] as const,
  }
)

export const VideoApprovalLinkRef =
  builder.objectRef<VideoApprovalLinkView>('VideoApprovalLink')
export const VideoApprovalLink = VideoApprovalLinkRef.implement({
  fields: (t) => ({
    requestId: t.exposeID('requestId'),
    state: t.field({ type: VideoApprovalLinkState, resolve: (v) => v.state }),
    canApprove: t.exposeBoolean('canApprove'),
    canRevoke: t.exposeBoolean('canRevoke'),
    semester: t.exposeString('semester'),
    requestedAt: t.expose('requestedAt', { type: 'Date' }),
    requestedByName: t.exposeString('requestedByName'),
    requestedByEmail: t.exposeString('requestedByEmail'),
    grantExpiresAt: t.expose('grantExpiresAt', { type: 'Date' }),
    validUntil: t.expose('validUntil', { type: 'Date', nullable: true }),
    recipientName: t.exposeString('recipientName'),
    recipientEmail: t.exposeString('recipientEmail'),
    signedInEmail: t.exposeString('signedInEmail'),
    identityMatched: t.exposeBoolean('identityMatched'),
    eduIdSignedIn: t.exposeBoolean('eduIdSignedIn'),
    eduIdRequired: t.exposeBoolean('eduIdRequired'),
    courseTitle: t.exposeString('courseTitle'),
    courseShortName: t.exposeString('courseShortName'),
    catalogUrl: t.exposeString('catalogUrl'),
    responsibleNames: t.exposeStringList('responsibleNames'),
    sourceName: t.exposeString('sourceName'),
    sourceUrl: t.exposeString('sourceUrl'),
    kalturaCategoryId: t.exposeString('kalturaCategoryId'),
    cutMode: t.field({ type: KBVideoCutMode, resolve: (v) => v.cutMode }),
    chatbotNames: t.exposeStringList('chatbotNames'),
    consentVersion: t.exposeString('consentVersion'),
    consentText: t.exposeString('consentText'),
    decidedByName: t.exposeString('decidedByName', { nullable: true }),
    decidedAt: t.expose('decidedAt', { type: 'Date', nullable: true }),
  }),
})

type IRecipient = DB.KBVideoApprovalRecipient
type IDecision = DB.KBVideoApprovalDecision
type IRequest = DB.KBVideoApprovalRequest & {
  recipients: IRecipient[]
  decisions: IDecision[]
}
type ISource = DB.KBVideoSource & { requests?: IRequest[] }

export const KBVideoApprovalRecipientRef = builder
  .objectRef<IRecipient>('KBVideoApprovalRecipient')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      email: t.exposeString('email'),
      roles: t.exposeStringList('roles'),
      sentAt: t.expose('sentAt', { type: 'Date', nullable: true }),
      firstOpenedAt: t.expose('firstOpenedAt', {
        type: 'Date',
        nullable: true,
      }),
    }),
  })

export const KBVideoApprovalDecisionRef = builder
  .objectRef<IDecision>('KBVideoApprovalDecision')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      kind: t.field({
        type: KBVideoApprovalDecisionKind,
        resolve: (d) => d.kind,
      }),
      recipientId: t.exposeID('recipientId', { nullable: true }),
      userEmail: t.exposeString('userEmail'),
      eduIdSignedIn: t.boolean({ resolve: (d) => d.eduIdSubject !== null }),
      identityMatched: t.exposeBoolean('identityMatched'),
      reason: t.exposeString('reason', { nullable: true }),
      createdAt: t.expose('createdAt', { type: 'Date' }),
    }),
  })

export const KBVideoApprovalRequestRef = builder
  .objectRef<IRequest>('KBVideoApprovalRequest')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      semester: t.exposeString('semester'),
      status: t.field({
        type: KBVideoApprovalRequestStatus,
        resolve: (r) => r.status,
      }),
      kalturaCategoryId: t.exposeString('kalturaCategoryId'),
      requestedByName: t.exposeString('requestedByName'),
      requestedByEmail: t.exposeString('requestedByEmail'),
      catalogSnapshotSha256: t.exposeString('catalogSnapshotSha256'),
      consentVersion: t.exposeString('consentVersion'),
      grantExpiresAt: t.expose('grantExpiresAt', { type: 'Date' }),
      validUntil: t.expose('validUntil', { type: 'Date', nullable: true }),
      approvedAt: t.expose('approvedAt', { type: 'Date', nullable: true }),
      adminApprovedAt: t.expose('adminApprovedAt', {
        type: 'Date',
        nullable: true,
      }),
      revokedAt: t.expose('revokedAt', { type: 'Date', nullable: true }),
      createdAt: t.expose('createdAt', { type: 'Date' }),
      recipients: t.field({
        type: [KBVideoApprovalRecipientRef],
        resolve: (r) => r.recipients,
      }),
      decisions: t.field({
        type: [KBVideoApprovalDecisionRef],
        resolve: (r) => r.decisions,
      }),
    }),
  })

export const KBVideoSourceRef = builder
  .objectRef<ISource>('KBVideoSource')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      kbId: t.exposeID('kbId'),
      name: t.exposeString('name'),
      sourceKind: t.field({
        type: KBVideoSourceKind,
        resolve: (s) => s.sourceKind,
      }),
      sourceUrl: t.exposeString('sourceUrl'),
      catalogUrl: t.exposeString('catalogUrl'),
      kalturaCategoryId: t.exposeString('kalturaCategoryId'),
      cutMode: t.field({ type: KBVideoCutMode, resolve: (s) => s.cutMode }),
      namePattern: t.exposeString('namePattern', { nullable: true }),
      captionLanguage: t.exposeString('captionLanguage'),
      status: t.field({
        type: KBVideoSourceStatus,
        resolve: (s) => s.status,
      }),
      validUntil: t.expose('validUntil', { type: 'Date', nullable: true }),
      requests: t.field({
        type: [KBVideoApprovalRequestRef],
        resolve: (s) => s.requests ?? [],
      }),
    }),
  })

interface IRequestResult {
  requestId: string
  semester: string
  grantExpiresAt: Date
  recipients: Array<{
    name: string
    email: string
    roles: string[]
    sent: boolean
  }>
  contactsWithoutEmail: string[]
  warnings: string[]
}

const VideoApprovalRequestRecipientRef = builder
  .objectRef<IRequestResult['recipients'][number]>(
    'VideoApprovalRequestRecipient'
  )
  .implement({
    fields: (t) => ({
      name: t.exposeString('name'),
      email: t.exposeString('email'),
      roles: t.exposeStringList('roles'),
      sent: t.exposeBoolean('sent'),
    }),
  })

export const VideoApprovalRequestResultRef = builder
  .objectRef<IRequestResult>('VideoApprovalRequestResult')
  .implement({
    fields: (t) => ({
      requestId: t.exposeID('requestId'),
      semester: t.exposeString('semester'),
      grantExpiresAt: t.expose('grantExpiresAt', { type: 'Date' }),
      recipients: t.field({
        type: [VideoApprovalRequestRecipientRef],
        resolve: (r) => r.recipients,
      }),
      contactsWithoutEmail: t.exposeStringList('contactsWithoutEmail'),
      warnings: t.exposeStringList('warnings'),
    }),
  })

export const VideoApprovalRecipientInput = builder.inputType(
  'VideoApprovalRecipientInput',
  {
    fields: (t) => ({
      name: t.string({ required: true }),
      email: t.string({ required: true }),
    }),
  }
)
