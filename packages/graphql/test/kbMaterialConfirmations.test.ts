import type * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  getKbMaterialScopeFingerprint,
  KB_MATERIAL_NOTICE_VERSION,
  KB_MATERIAL_PURPOSE,
} from '../src/lib/kbMaterialConfirmation.js'
import {
  recordKbMaterialConfirmation,
  requireKbMaterialConfirmation,
} from '../src/services/kbMaterialConfirmations.js'

const KB_ID = '00000000-0000-4000-8000-000000000001'
const ACTOR_ID = '00000000-0000-4000-8000-000000000002'
const RESOURCE_ID = '00000000-0000-4000-8000-000000000003'
const RECEIPT_ID = '00000000-0000-4000-8000-000000000004'
const CHATBOT_ID = '00000000-0000-4000-8000-000000000005'
const OTHER_CHATBOT_ID = '00000000-0000-4000-8000-000000000006'
const SOURCE_KEY = 'source:document-1'

type ScopeBinding = { chatbotId: string; courseId: string | null }

type Receipt = {
  id: string
  kbId: string
  actorId: string
  resourceId: string
  sourceKey: string
  noticeVersion: string
  rightsConfirmed: boolean
  personalDataConfirmed: boolean
  purpose: string
  scopeFingerprint: string
  scopeSnapshot: string
}

const currentScope: ScopeBinding[] = [{ chatbotId: CHATBOT_ID, courseId: null }]
const confirmedScope: ScopeBinding[] = [
  ...currentScope,
  { chatbotId: OTHER_CHATBOT_ID, courseId: 'course-1' },
]

function validReceipt(
  overrides: Partial<Receipt> = {},
  scope: ScopeBinding[] = confirmedScope
): Receipt {
  return {
    id: RECEIPT_ID,
    kbId: KB_ID,
    actorId: ACTOR_ID,
    resourceId: RESOURCE_ID,
    sourceKey: SOURCE_KEY,
    noticeVersion: KB_MATERIAL_NOTICE_VERSION,
    rightsConfirmed: true,
    personalDataConfirmed: true,
    purpose: KB_MATERIAL_PURPOSE,
    scopeFingerprint: getKbMaterialScopeFingerprint(scope),
    scopeSnapshot: JSON.stringify(scope),
    ...overrides,
  }
}

function createPrismaMock({
  receipt = null,
  scope = currentScope,
}: {
  receipt?: Receipt | null
  scope?: ScopeBinding[]
} = {}) {
  const findUnique = vi.fn().mockResolvedValue(receipt)
  const findMany = vi.fn().mockResolvedValue(
    scope.map(({ chatbotId, courseId }) => ({
      chatbotId,
      chatbot: { courseId },
    }))
  )
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: RECEIPT_ID,
    ...data,
  }))

  const prisma = {
    kBChatbot: { findMany },
    kBMaterialConfirmation: { create, findUnique },
  } as unknown as DB.Prisma.TransactionClient

  return { prisma, create, findMany, findUnique }
}

describe('KB material confirmation service', () => {
  it('stores server-owned notice, purpose, and scope metadata', async () => {
    const { prisma, create } = createPrismaMock()

    await recordKbMaterialConfirmation(prisma, {
      kbId: KB_ID,
      actorId: ACTOR_ID,
      confirmation: {
        rightsConfirmed: true,
        personalDataConfirmed: true,
        noticeVersion: KB_MATERIAL_NOTICE_VERSION,
      },
      scope: currentScope,
    })

    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      kbId: KB_ID,
      actorId: ACTOR_ID,
      noticeVersion: KB_MATERIAL_NOTICE_VERSION,
      rightsConfirmed: true,
      personalDataConfirmed: true,
      purpose: KB_MATERIAL_PURPOSE,
      scopeFingerprint: getKbMaterialScopeFingerprint(currentScope),
      scopeSnapshot: JSON.stringify(currentScope),
    })
  })

  it.each([
    ['missing receipt ID', null, null],
    ['missing receipt row', null, RECEIPT_ID],
    ['foreign actor', validReceipt({ actorId: 'foreign-actor' }), RECEIPT_ID],
    ['foreign KB', validReceipt({ kbId: 'foreign-kb' }), RECEIPT_ID],
    [
      'foreign resource',
      validReceipt({ resourceId: 'foreign-resource' }),
      RECEIPT_ID,
    ],
    [
      'foreign source',
      validReceipt({ sourceKey: 'foreign-source' }),
      RECEIPT_ID,
    ],
    [
      'stale notice version',
      validReceipt({ noticeVersion: '2026-09-08' }),
      RECEIPT_ID,
    ],
    [
      'unconfirmed rights',
      validReceipt({ rightsConfirmed: false }),
      RECEIPT_ID,
    ],
    [
      'unconfirmed personal data',
      validReceipt({ personalDataConfirmed: false }),
      RECEIPT_ID,
    ],
  ])('rejects %s before scope lookup', async (_, receipt, receiptId) => {
    const fixture = createPrismaMock({
      receipt: receipt as Receipt | null,
    })

    await expect(
      requireKbMaterialConfirmation(fixture.prisma, {
        receiptId,
        kbId: KB_ID,
        actorId: ACTOR_ID,
        sourceKey: SOURCE_KEY,
        resourceId: RESOURCE_ID,
      })
    ).rejects.toMatchObject({
      extensions: { code: 'KB_MATERIAL_CONFIRMATION_REQUIRED' },
    })

    expect(fixture.findMany).not.toHaveBeenCalled()
  })

  it('accepts a narrowed current audience from a broader confirmation', async () => {
    const fixture = createPrismaMock({
      receipt: validReceipt(),
      scope: currentScope,
    })

    await expect(
      requireKbMaterialConfirmation(fixture.prisma, {
        receiptId: RECEIPT_ID,
        kbId: KB_ID,
        actorId: ACTOR_ID,
        sourceKey: SOURCE_KEY,
        resourceId: RESOURCE_ID,
      })
    ).resolves.toEqual(validReceipt())
  })

  it.each([
    [
      'a newly attached audience',
      [
        ...currentScope,
        { chatbotId: '00000000-0000-4000-8000-000000000007', courseId: null },
      ],
    ],
    [
      'a changed chatbot-course binding',
      [{ chatbotId: CHATBOT_ID, courseId: 'changed-course' }],
    ],
  ])('rejects %s after confirmation', async (_, scope) => {
    const fixture = createPrismaMock({
      receipt: validReceipt({}, confirmedScope),
      scope,
    })

    await expect(
      requireKbMaterialConfirmation(fixture.prisma, {
        receiptId: RECEIPT_ID,
        kbId: KB_ID,
        actorId: ACTOR_ID,
        sourceKey: SOURCE_KEY,
        resourceId: RESOURCE_ID,
      })
    ).rejects.toMatchObject({
      extensions: { code: 'KB_MATERIAL_SCOPE_CHANGED' },
    })

    expect(fixture.findUnique).toHaveBeenCalledOnce()
    expect(fixture.findMany).toHaveBeenCalledOnce()
  })

  it.each([
    ['malformed JSON', '{'],
    [
      'a malformed binding shape',
      JSON.stringify([{ chatbotId: CHATBOT_ID, courseId: 1 }]),
    ],
  ])('denies %s in the stored scope', async (_label, scopeSnapshot) => {
    const fixture = createPrismaMock({
      receipt: validReceipt({ scopeSnapshot }, confirmedScope),
    })

    await expect(
      requireKbMaterialConfirmation(fixture.prisma, {
        receiptId: RECEIPT_ID,
        kbId: KB_ID,
        actorId: ACTOR_ID,
        sourceKey: SOURCE_KEY,
        resourceId: RESOURCE_ID,
      })
    ).rejects.toMatchObject({
      extensions: { code: 'KB_MATERIAL_CONFIRMATION_REQUIRED' },
    })
  })
})
