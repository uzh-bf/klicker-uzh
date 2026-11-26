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
  getKbVideoSources,
  getVideoApprovalLink,
  handleVideoSourceScope,
  rejectVideoSource,
  requestVideoSourceApproval,
  revokeVideoSourceByLink,
  submitVideoSource,
  verifyVideoSource,
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
// The per-lecturer `lecture-video-sources` flag as GrowthBook would answer it.
let videoFlagOn = true
const featureFlags = {
  isEnabled: (key: string) => key === 'lecture-video-sources' && videoFlagOn,
}
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
    featureFlags,
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

// A KB owner submits the two links; an admin verifies them later.
async function setup({
  sourceUrl = 'https://lms.example.org/auth/RepositoryEntry/1000001/CourseNode/2000001',
  sourceProvider = provider as CourseSourcesProvider | null,
} = {}) {
  const admin = await user('admin', {
    role: DB.UserRole.ADMIN,
  })
  const owner = await user('owner')
  const kb = await prisma.kB.create({
    data: { name: 'Synthetic KB', ownerId: owner.user.sub },
  })
  kbIds.push(kb.id)
  const source = await submitVideoSource(
    {
      kbId: kb.id,
      name: 'Synthetic lecture recordings',
      sourceUrl,
      directoryUrl: DIRECTORY_URL,
    },
    owner,
    { provider: sourceProvider }
  )
  return { admin, owner, source }
}

function verify(
  args: Partial<Parameters<typeof verifyVideoSource>[0]> & {
    sourceId: string
  },
  ctx: ContextWithUser,
  deps: Parameters<typeof verifyVideoSource>[2]
) {
  return verifyVideoSource(
    {
      kalturaCategoryId: '100001',
      cutMode: 'CLIP',
      captionLanguage: 'de',
      ...args,
    },
    ctx,
    deps
  )
}

const at = (iso: string) => () => new Date(iso)

describe('video source approval', () => {
  it('requests, approves once, gets admin approval, and revokes after expiry', async () => {
    const { admin, source } = await setup()
    const head = await user('head')

    const result = await verify(
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
      'SOURCE_SUBMITTED',
      'SOURCE_VERIFIED',
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
    await verify({ sourceId: source.id }, admin, {
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
    await verify({ sourceId: source.id }, admin, {
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
    await verify({ sourceId: source.id }, admin, {
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

  it('lets only the KB owner submit, with links the provider knows', async () => {
    const { admin, owner, source } = await setup()
    expect(source).toMatchObject({
      status: 'SUBMITTED',
      sourceKind: 'OLAT_NODE',
      externalRef: '2000001',
      kalturaCategoryId: null,
    })
    const base = {
      kbId: source.kbId,
      name: 'Synthetic channel',
      sourceUrl: 'https://media.example.org/channel/Synthetic+Course/100002',
      directoryUrl: DIRECTORY_URL,
    }
    await expect(submitVideoSource(base, admin, { provider })).rejects.toThrow(
      'KB not found'
    )
    await expect(
      submitVideoSource(
        { ...base, sourceUrl: 'https://lms.example.org/node/1' },
        owner,
        { provider }
      )
    ).rejects.toThrow('provider knows')
    await expect(
      submitVideoSource({ ...base, directoryUrl: 'not a link' }, owner, {
        provider,
      })
    ).rejects.toThrow('course directory link')
    videoFlagOn = false
    await expect(submitVideoSource(base, owner, { provider })).rejects.toThrow(
      'not available yet'
    )
    videoFlagOn = true

    // Nothing can be requested before an admin verified the links.
    await expect(
      requestVideoSourceApproval({ sourceId: source.id }, admin, { provider })
    ).rejects.toThrow('Verify the source')

    const channel = await submitVideoSource(base, owner, { provider })
    expect(channel).toMatchObject({
      sourceKind: 'KALTURA_CHANNEL',
      fixedCollectionId: '100002',
    })
    await expect(
      verify({ sourceId: channel.id, kalturaCategoryId: '100003' }, admin, {
        provider,
      })
    ).rejects.toThrow('does not match')
  })

  it('lets an admin reject a submission with a reason', async () => {
    const { admin, owner, source } = await setup()
    await expect(
      rejectVideoSource({ sourceId: source.id, reason: ' ' }, admin)
    ).rejects.toThrow('reason')
    const rejected = await rejectVideoSource(
      { sourceId: source.id, reason: 'Channel belongs to another course' },
      admin
    )
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Channel belongs to another course',
    })
    await expect(
      verify({ sourceId: source.id }, admin, { provider })
    ).rejects.toThrow('Only a submitted source')
    const listed = await getKbVideoSources({ kbId: source.kbId }, owner)
    expect(listed.map((s) => s.status)).toEqual(['REJECTED'])
    expect(await getKbVideoSources({ kbId: source.kbId }, admin)).toEqual([])
  })

  it('works without a provider from what the admin enters', async () => {
    const { admin, source } = await setup({
      sourceUrl: 'https://media.example.org/anything/42',
      sourceProvider: null,
    })
    expect(source).toMatchObject({ sourceKind: 'MANUAL', externalRef: null })

    const manual = {
      courseTitle: 'Synthetic Manual Course',
      periodLabel: 'Fall 2026',
      periodEnd: new Date('2027-01-31T23:00:00Z'),
    }
    await expect(
      verify({ sourceId: source.id, manual }, admin, {
        provider: null,
        now: at('2026-11-23T10:00:00Z'),
      })
    ).rejects.toThrow('add at least one recipient')
    // The verification itself stays; sending can be retried.
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

describe('gateway scope check', () => {
  const env = { VIDEO_SOURCE_SCOPE_TOKEN: 'fake-scope-credential' }
  const authorization = 'Bearer fake-scope-credential'

  it('answers only an authorized caller and audits every read', async () => {
    const { admin, source } = await setup()
    expect(
      await handleVideoSourceScope({
        prisma,
        body: { sourceId: source.id },
        authorization: 'Bearer wrong',
        env,
      })
    ).toMatchObject({ statusCode: 401 })
    expect(
      await handleVideoSourceScope({
        prisma,
        body: { sourceId: source.id },
        authorization,
        env: {},
      })
    ).toMatchObject({ statusCode: 503 })
    expect(
      await handleVideoSourceScope({
        prisma,
        body: { sourceId: 'x' },
        authorization,
        env,
      })
    ).toMatchObject({ statusCode: 400 })

    const pending = await handleVideoSourceScope({
      prisma,
      body: { sourceId: source.id },
      authorization,
      env,
    })
    expect(pending).toMatchObject({
      statusCode: 200,
      body: { source: { status: 'SUBMITTED', approved: false } },
    })

    const result = await verify({ sourceId: source.id }, admin, {
      provider,
      now: at('2026-11-23T10:00:00Z'),
    })
    await approveVideoSourceByLink(
      { token: tokenFor(HEAD_EMAIL), consentVersion: '2026-11-v1' },
      await user('recipient'),
      { now: at('2026-11-24T10:00:00Z') }
    )
    await adminApproveVideoSourceRequest(
      { requestId: result.requestId },
      admin,
      { now: at('2026-11-25T10:00:00Z') }
    )
    const check = (iso: string) =>
      handleVideoSourceScope({
        prisma,
        body: { sourceId: source.id },
        authorization,
        env,
        now: at(iso),
      })
    expect(await check('2026-12-01T00:00:00Z')).toEqual({
      statusCode: 200,
      body: {
        source: {
          sourceId: source.id,
          status: 'APPROVED',
          activeRequestId: result.requestId,
          validUntil: '2027-02-01T00:00:00.000Z',
          kalturaCategoryId: '100001',
          cutMode: 'CLIP',
          namePattern: null,
          captionLanguage: 'de',
          approved: true,
        },
      },
    })
    expect(await check('2027-02-01T00:00:00Z')).toMatchObject({
      body: { source: { approved: false } },
    })

    const reads = await prisma.kBVideoAuditEvent.findMany({
      where: { sourceId: source.id, type: 'SCOPE_READ' },
    })
    // Only authorized, well-formed requests reach the database.
    expect(reads).toHaveLength(3)
  })

  it('answers null for an unknown source', async () => {
    expect(
      await handleVideoSourceScope({
        prisma,
        body: { sourceId: randomUUID() },
        authorization,
        env,
      })
    ).toEqual({ statusCode: 200, body: { source: null } })
  })
})
