import { randomUUID } from 'node:crypto'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  CourseSourcesError,
  type CourseSourcesProvider,
} from '../src/services/courseSources.js'
import {
  adminApproveVideoSourceRequest,
  adminRevokeVideoSource,
  approveVideoSourceByLink,
  createVideoSource,
  getVideoApprovalLink,
  requestVideoSourceApproval,
  revokeVideoSourceByLink,
} from '../src/services/videoSourceApproval.js'
import {
  compareCodeUnits,
  findAuditChainBreak,
  hashApprovalToken,
} from '../src/services/videoSourceApprovalCore.js'

// Captures sent emails instead of sending them. Each email's link carries the
// only copy of its token.
const sentEmails: Array<{ to: string; text: string; html: string }> = []
vi.mock('../src/services/email.js', () => ({
  hydrateTemplate: async ({
    templateName,
    variables,
  }: {
    templateName: string
    variables: Record<string, string>
  }) => `${templateName}:${JSON.stringify(variables)}`,
  sendEmail: async (mail: { to: string; text: string; html: string }) => {
    sentEmails.push(mail)
    return true
  },
}))

// Synthetic people only.
const HEAD_EMAIL = 'head@example.org'
const LECTURER_EMAIL = 'lecturer@example.org'

const PERIOD = {
  label: 'HS26',
  start: new Date('2026-08-01T00:00:00Z'),
  end: new Date('2027-02-01T00:00:00Z'),
}
const DIRECTORY_URL = 'https://directory.example.org/courses/51000001'

// Stands in for the course-sources provider (see courseSources.CONTRACT.md).
const provider: CourseSourcesProvider = {
  async sourceLink({ sourceUrl }) {
    const channel = sourceUrl.match(/\/channel\/[^/]+\/(\d+)$/)
    if (channel) {
      return {
        kind: 'KALTURA_CHANNEL',
        externalRef: channel[1]!,
        fixedCollectionId: channel[1]!,
      }
    }
    const node = sourceUrl.match(/\/CourseNode\/(\d+)$/)
    if (node) {
      return {
        kind: 'OLAT_NODE',
        externalRef: node[1]!,
        fixedCollectionId: null,
      }
    }
    throw new CourseSourcesError(
      'Not a recordings link this provider knows',
      'INVALID_SOURCE_URL',
      422
    )
  },
  async directory() {
    return {
      period: PERIOD,
      directory: {
        canonicalUrl: DIRECTORY_URL,
        title: 'Synthetic <Finance>',
        shortName: 'SF',
        recipients: [
          {
            name: 'Prof. Dr. Alex Head',
            email: HEAD_EMAIL,
            roles: ['RESPONSIBLE'],
          },
          { name: 'Sam Lecturer', email: LECTURER_EMAIL, roles: ['LECTURER'] },
        ],
        withoutEmail: [],
        warnings: [],
        snapshot: { moduleId: '51000001', retrievedAt: '2026-11-23T10:00Z' },
      },
    }
  },
  async resolve() {
    throw new Error('not used here')
  },
}

let prisma: DB.PrismaClient
const userIds: string[] = []
const kbIds: string[] = []

beforeAll(async () => {
  process.env.NEXT_PUBLIC_MANAGE_URL = 'https://manage.example.org'
  prisma = await createDisposableTestPrismaClient(process.env.DATABASE_URL!)
})

afterAll(async () => {
  if (prisma) {
    await requireDisposableDatabase(prisma)
    await prisma.kB.deleteMany({ where: { id: { in: kbIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.$disconnect()
  }
})

async function user(
  label: string,
  {
    role = DB.UserRole.USER,
    eduId = true,
  }: { role?: DB.UserRole; eduId?: boolean } = {}
): Promise<ContextWithUser> {
  await requireDisposableDatabase(prisma)
  const id = randomUUID()
  userIds.push(id)
  await prisma.user.create({
    data: {
      id,
      // Never one of the directory emails: edu-ID accounts often differ.
      email: `${id}@example.org`,
      name: `Synthetic ${label}`,
      shortname: id.slice(0, 8),
      role,
      ...(eduId
        ? {
            accounts: {
              create: {
                type: 'oidc',
                provider: 'eduid',
                providerAccountId: `sub-${id}`,
              },
            },
          }
        : {}),
    },
  })
  return {
    prisma,
    user: {
      sub: id,
      role,
      scope: DB.UserLoginScope.FULL_ACCESS,
      catalystInstitutional: true,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

function tokenFor(email: string) {
  const mail = [...sentEmails].reverse().find((m) => m.to === email)
  const token = mail?.text.match(/token=([A-Za-z0-9_-]{43})/)?.[1]
  if (!token) throw new Error(`no link sent to ${email}`)
  return token
}

async function setup() {
  const admin = await user('admin', {
    role: DB.UserRole.ADMIN,
  })
  const kb = await prisma.kB.create({
    data: { name: 'Synthetic KB', ownerId: admin.user.sub },
  })
  kbIds.push(kb.id)
  const source = await createVideoSource(
    {
      kbId: kb.id,
      name: 'Synthetic lecture recordings',
      sourceUrl:
        'https://lms.example.org/auth/RepositoryEntry/1000001/CourseNode/2000001',
      directoryUrl: DIRECTORY_URL,
      kalturaCategoryId: '100001',
      cutMode: 'CLIP',
      captionLanguage: 'de',
    },
    admin,
    { provider }
  )
  return { admin, source }
}

const at = (iso: string) => () => new Date(iso)

describe('video source approval', () => {
  it('requests, approves once, gets admin approval, and revokes after expiry', async () => {
    const { admin, source } = await setup()
    const head = await user('head')

    const result = await requestVideoSourceApproval(
      { sourceId: source.id, period: 'HS26' },
      admin,
      { provider, now: at('2026-11-23T10:00:00Z') }
    )
    expect(result.recipients.map((r) => r.email)).toEqual([
      HEAD_EMAIL,
      LECTURER_EMAIL,
    ])
    expect(result.grantExpiresAt.toISOString()).toBe('2026-12-07T10:00:00.000Z')

    // The email names the requester; only the token hash is stored.
    const headToken = tokenFor(HEAD_EMAIL)
    const lecturerToken = tokenFor(LECTURER_EMAIL)
    const headMail = [...sentEmails].reverse().find((m) => m.to === HEAD_EMAIL)!
    expect(headMail.text).toContain('Synthetic admin')
    expect(headMail.html).toContain('Synthetic &lt;Finance&gt;')
    const stored = await prisma.kBVideoApprovalRecipient.findMany({
      where: { requestId: result.requestId },
    })
    expect(stored.map((r) => r.tokenSha256).sort(compareCodeUnits)).toEqual(
      [hashApprovalToken(headToken), hashApprovalToken(lecturerToken)].sort(
        compareCodeUnits
      )
    )
    expect(JSON.stringify(stored)).not.toContain(headToken)

    // The landing page shows who requested it.
    const view = await getVideoApprovalLink({ token: headToken }, head, {
      now: at('2026-11-24T10:00:00Z'),
    })
    expect(view).toMatchObject({
      state: 'AWAITING_APPROVAL',
      canApprove: true,
      requestedByName: 'Synthetic admin',
      recipientEmail: HEAD_EMAIL,
      identityMatched: false, // signed-in edu-ID mail differs
      courseTitle: 'Synthetic <Finance>',
      responsibleNames: ['Prof. Dr. Alex Head'],
    })

    const approved = await approveVideoSourceByLink(
      { token: headToken, consentVersion: view.consentVersion },
      head,
      { now: at('2026-11-24T10:05:00Z') }
    )
    expect(approved).toMatchObject({ state: 'AWAITING_ADMIN', canRevoke: true })
    // The other recipient is told and can no longer approve.
    expect(sentEmails.at(-1)?.to).toBe(LECTURER_EMAIL)
    const lecturer = await user('recipient')
    await expect(
      approveVideoSourceByLink(
        { token: lecturerToken, consentVersion: view.consentVersion },
        lecturer,
        { now: at('2026-11-24T11:00:00Z') }
      )
    ).rejects.toThrow('can no longer approve')

    let current = await adminApproveVideoSourceRequest(
      { requestId: result.requestId },
      admin,
      { now: at('2026-11-25T08:00:00Z') }
    )
    expect(current).toMatchObject({
      status: 'APPROVED',
      activeRequestId: result.requestId,
    })
    expect(current.validUntil?.toISOString()).toBe('2027-02-01T00:00:00.000Z')

    // Months after the grant window, the same link still revokes.
    const revoked = await revokeVideoSourceByLink(
      { token: headToken, reason: 'changed my mind' },
      head,
      { now: at('2027-03-15T09:00:00Z') }
    )
    expect(revoked).toMatchObject({ state: 'REVOKED', canRevoke: false })
    current = await prisma.kBVideoSource.findUniqueOrThrow({
      where: { id: source.id },
    })
    expect(current).toMatchObject({
      status: 'REVOKED',
      activeRequestId: null,
      validUntil: null,
    })

    const events = await prisma.kBVideoAuditEvent.findMany({
      where: { sourceId: source.id },
      orderBy: { seq: 'asc' },
    })
    expect(events.map((e) => e.type)).toEqual([
      'SOURCE_CONFIGURED',
      'APPROVAL_REQUESTED',
      'APPROVAL_EMAILS_SENT',
      'APPROVAL_LINK_OPENED',
      'APPROVAL_GRANTED',
      'ADMIN_APPROVED',
      'APPROVAL_REVOKED',
      'REVOCATION_PURGE_REQUESTED',
    ])
    const decisions = await prisma.kBVideoApprovalDecision.findMany({
      where: { requestId: result.requestId },
      orderBy: { createdAt: 'asc' },
    })
    expect(decisions.map((d) => [d.kind, d.identityMatched])).toEqual([
      ['APPROVE', false],
      ['ADMIN_APPROVE', true],
      ['REVOKE', false],
    ])
    expect(decisions[0]!.eduIdSubject).toBe(`sub-${head.user.sub}`)
  })

  it('keeps the whole audit log chained and append-only', async () => {
    await requireDisposableDatabase(prisma)
    const rows = await prisma.kBVideoAuditEvent.findMany({
      orderBy: { seq: 'asc' },
    })
    expect(rows.length).toBeGreaterThan(0)
    expect(findAuditChainBreak(rows)).toBeNull()
    await expect(
      prisma.kBVideoAuditEvent.update({
        where: { seq: rows[0]!.seq },
        data: { type: 'TAMPERED' },
      })
    ).rejects.toThrow()
    await expect(
      prisma.kBVideoAuditEvent.delete({ where: { seq: rows[0]!.seq } })
    ).rejects.toThrow()
  })

  it('requires edu-ID and an open grant window to approve', async () => {
    const { admin, source } = await setup()
    await requestVideoSourceApproval({ sourceId: source.id }, admin, {
      provider,
      now: at('2026-11-23T10:00:00Z'),
    })
    const token = tokenFor(LECTURER_EMAIL)
    const delegated = await user('delegated', { eduId: false })
    await expect(
      approveVideoSourceByLink(
        { token, consentVersion: '2026-11-v1' },
        delegated,
        { now: at('2026-11-24T10:00:00Z') }
      )
    ).rejects.toThrow('edu-ID')

    const lecturer = await user('recipient')
    await expect(
      approveVideoSourceByLink({ token, consentVersion: 'old' }, lecturer, {
        now: at('2026-11-24T10:00:00Z'),
      })
    ).rejects.toThrow('consent text changed')
    await expect(
      approveVideoSourceByLink(
        { token, consentVersion: '2026-11-v1' },
        lecturer,
        { now: at('2026-12-07T10:00:00Z') }
      )
    ).rejects.toThrow('can no longer approve')

    // After the window the link can still decline.
    const declined = await revokeVideoSourceByLink({ token }, lecturer, {
      now: at('2026-12-20T10:00:00Z'),
    })
    expect(declined.state).toBe('REVOKED')
    await expect(
      getVideoApprovalLink({ token: 'x'.repeat(43) }, lecturer)
    ).rejects.toThrow('not valid')
  })

  it('forwards a superseded link to the newer request for revoking only', async () => {
    const { admin, source } = await setup()
    await requestVideoSourceApproval({ sourceId: source.id }, admin, {
      provider,
      now: at('2026-11-23T10:00:00Z'),
    })
    const oldToken = tokenFor(HEAD_EMAIL)
    const second = await requestVideoSourceApproval(
      { sourceId: source.id },
      admin,
      { provider, now: at('2026-12-10T10:00:00Z') }
    )
    const newToken = tokenFor(HEAD_EMAIL)
    expect(newToken).not.toBe(oldToken)

    const head = await user('recipient')
    const oldView = await getVideoApprovalLink({ token: oldToken }, head, {
      now: at('2026-12-11T10:00:00Z'),
    })
    expect(oldView).toMatchObject({
      requestId: second.requestId,
      canApprove: false,
      canRevoke: true,
    })
    await approveVideoSourceByLink(
      { token: newToken, consentVersion: '2026-11-v1' },
      head,
      { now: at('2026-12-11T10:05:00Z') }
    )
    await adminApproveVideoSourceRequest(
      { requestId: second.requestId },
      admin,
      { now: at('2026-12-12T10:00:00Z') }
    )
    const revoked = await revokeVideoSourceByLink({ token: oldToken }, head, {
      now: at('2027-05-01T10:00:00Z'),
    })
    expect(revoked).toMatchObject({
      requestId: second.requestId,
      state: 'REVOKED',
    })
  })

  it('lets an admin revoke a source with a reason', async () => {
    const { admin, source } = await setup()
    await requestVideoSourceApproval({ sourceId: source.id }, admin, {
      provider,
      now: at('2026-11-23T10:00:00Z'),
    })
    await expect(
      adminRevokeVideoSource({ sourceId: source.id, reason: ' ' }, admin)
    ).rejects.toThrow('reason')
    const revoked = await adminRevokeVideoSource(
      { sourceId: source.id, reason: 'wrong category' },
      admin
    )
    expect(revoked.status).toBe('REVOKED')
  })

  it('takes the link kind from the provider and checks a fixed collection', async () => {
    const { admin, source } = await setup()
    expect(source).toMatchObject({
      sourceKind: 'OLAT_NODE',
      externalRef: '2000001',
    })
    const base = {
      kbId: source.kbId,
      name: 'Synthetic channel',
      sourceUrl: 'https://media.example.org/channel/Synthetic+Course/100002',
      directoryUrl: DIRECTORY_URL,
      kalturaCategoryId: '100002',
      cutMode: 'CLIP' as const,
      captionLanguage: 'de',
    }
    await expect(
      createVideoSource({ ...base, kalturaCategoryId: '100003' }, admin, {
        provider,
      })
    ).rejects.toThrow('does not match')
    await expect(
      createVideoSource(
        { ...base, sourceUrl: 'https://lms.example.org/node/1' },
        admin,
        { provider }
      )
    ).rejects.toThrow('provider knows')
    await expect(
      createVideoSource({ ...base, directoryUrl: 'not a link' }, admin, {
        provider,
      })
    ).rejects.toThrow('course directory link')
    const created = await createVideoSource(base, admin, { provider })
    expect(created).toMatchObject({
      sourceKind: 'KALTURA_CHANNEL',
      kalturaCategoryId: '100002',
    })
  })

  it('works without a provider from what the admin enters', async () => {
    const { admin, source: configured } = await setup()
    const source = await createVideoSource(
      {
        kbId: configured.kbId,
        name: 'Synthetic manual source',
        sourceUrl: 'https://media.example.org/anything/42',
        directoryUrl: DIRECTORY_URL,
        kalturaCategoryId: '100004',
        cutMode: 'CLIP',
        captionLanguage: 'de',
      },
      admin,
      { provider: null }
    )
    expect(source).toMatchObject({ sourceKind: 'MANUAL', externalRef: null })

    const manual = {
      courseTitle: 'Synthetic Manual Course',
      periodLabel: 'Fall 2026',
      periodEnd: new Date('2027-01-31T23:00:00Z'),
    }
    await expect(
      requestVideoSourceApproval({ sourceId: source.id, manual }, admin, {
        provider: null,
        now: at('2026-11-23T10:00:00Z'),
      })
    ).rejects.toThrow('add at least one recipient')
    await expect(
      requestVideoSourceApproval(
        {
          sourceId: source.id,
          additionalRecipients: [{ name: 'Sam', email: LECTURER_EMAIL }],
        },
        admin,
        { provider: null, now: at('2026-11-23T10:00:00Z') }
      )
    ).rejects.toThrow('enter the course title')

    const result = await requestVideoSourceApproval(
      {
        sourceId: source.id,
        manual,
        additionalRecipients: [
          { name: 'Sam Lecturer', email: LECTURER_EMAIL },
          { name: 'Sam again', email: ' Lecturer@Example.org ' },
        ],
      },
      admin,
      { provider: null, now: at('2026-11-23T10:00:00Z') }
    )
    expect(result).toMatchObject({ periodLabel: 'Fall 2026' })
    expect(result.recipients.map((r) => r.email)).toEqual([LECTURER_EMAIL])

    const lecturer = await user('recipient')
    await approveVideoSourceByLink(
      { token: tokenFor(LECTURER_EMAIL), consentVersion: '2026-11-v1' },
      lecturer,
      { now: at('2026-11-24T10:00:00Z') }
    )
    const approved = await adminApproveVideoSourceRequest(
      { requestId: result.requestId },
      admin,
      { now: at('2026-11-25T10:00:00Z') }
    )
    expect(approved.validUntil?.toISOString()).toBe('2027-01-31T23:00:00.000Z')
  })
})
