import { prisma } from '@klicker-uzh/prisma'
import {
  ElementStatus,
  ElementType,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import type { GraphQLEnumType, GraphQLObjectType } from 'graphql'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { activityInputContainsElementType } from '../src/services/activities.js'
import {
  getQrScanCode,
  getQrScanPrintData,
  manipulateElement,
} from '../src/services/elements.js'

const createdUserIds: string[] = []

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  createdUserIds.length = 0
})

describe('QR scan GraphQL contracts', () => {
  it('detects QR elements across new, retained, and duplicated activity inputs', () => {
    const base = {
      displayName: '',
      description: '',
      order: 0,
      elements: [],
    }
    expect(
      activityInputContainsElementType({
        stacksOrBlocks: [
          {
            ...base,
            elements: [
              {
                elementId: 42,
                existingInstanceId: null,
                duplicateInstance: false,
                order: 0,
              },
            ],
          },
        ],
        persistentInstances: [],
        duplicationInstances: [],
        elementMap: { 42: { type: ElementType.QR_SCAN } },
        type: ElementType.QR_SCAN,
      })
    ).toBe(true)
  })

  it('serializes QR_SCAN and exposes only safe participant fields', () => {
    const elementType = schema.getType('ElementType')
    const qrScanData = schema.getType('QrScanElementData')
    const groupDecision = schema.getType('GroupActivityDecision')

    expect(elementType?.constructor.name).toBe('GraphQLEnumType')
    expect((elementType as GraphQLEnumType).serialize('QR_SCAN')).toBe(
      'QR_SCAN'
    )
    expect(qrScanData?.constructor.name).toBe('GraphQLObjectType')
    expect(Object.keys((qrScanData as GraphQLObjectType).getFields())).toEqual(
      expect.arrayContaining([
        'id',
        'elementId',
        'name',
        'type',
        'content',
        'explanation',
        'basePoints',
        'pointsMultiplier',
      ])
    )
    expect((qrScanData as GraphQLObjectType).getFields()).not.toHaveProperty(
      'qrScanCode'
    )
    expect((groupDecision as GraphQLObjectType).getFields()).not.toHaveProperty(
      'qrScanResponse'
    )
  })

  it('looks up scan codes only for the authenticated owner', async () => {
    const findFirst = vi.fn().mockResolvedValue({ qrScanCode: 'safe-code' })
    const ctx = {
      user: { sub: 'owner-id' },
      prisma: { element: { findFirst } },
    } as unknown as ContextWithUser

    await expect(getQrScanCode({ elementId: 42 }, ctx)).resolves.toBe(
      'safe-code'
    )
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 42,
        type: 'QR_SCAN',
        ownerId: 'owner-id',
        isDeleted: false,
      },
      select: { qrScanCode: true },
    })
  })

  it('returns null when the element is not owned by the caller', async () => {
    const ctx = {
      user: { sub: 'other-user' },
      prisma: { element: { findFirst: vi.fn().mockResolvedValue(null) } },
    } as unknown as ContextWithUser

    await expect(getQrScanCode({ elementId: 42 }, ctx)).resolves.toBeNull()
  })

  it('generates unique ephemeral decoys for an owner-authorized print request', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 42,
      name: 'QR clue',
      content: 'Find it',
      qrScanCode: 'real_code-12',
    })
    const ctx = {
      user: { sub: 'owner-id' },
      prisma: { element: { findFirst } },
    } as unknown as ContextWithUser

    const result = await getQrScanPrintData(
      { elementId: 42, decoyCount: 5 },
      ctx
    )

    expect(result?.code).toBe('real_code-12')
    expect(result?.decoys).toHaveLength(5)
    expect(new Set(result?.decoys)).toHaveLength(5)
    expect(result?.decoys).not.toContain(result?.code)
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 42,
        type: 'QR_SCAN',
        ownerId: 'owner-id',
        isDeleted: false,
      },
      select: { id: true, name: true, content: true, qrScanCode: true },
    })
  })

  it('returns null print data when the caller does not own the element', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const ctx = {
      user: { sub: 'other-user' },
      prisma: { element: { findFirst } },
    } as unknown as ContextWithUser

    await expect(
      getQrScanPrintData({ elementId: 42, decoyCount: 3 }, ctx)
    ).resolves.toBeNull()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: 'other-user' }),
      })
    )
  })

  it('rejects invalid decoy counts before reading an element', async () => {
    const findFirst = vi.fn()
    const ctx = {
      user: { sub: 'owner-id' },
      prisma: { element: { findFirst } },
    } as unknown as ContextWithUser

    await expect(
      getQrScanPrintData({ elementId: 42, decoyCount: 21 }, ctx)
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('creates a code, preserves it on edit, and rotates it on duplication', async () => {
    const userId = randomUUID()
    createdUserIds.push(userId)
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        shortname: `qr-${userId.slice(0, 8)}`,
      },
    })
    const ctx = {
      prisma,
      emitter: new EventEmitter(),
      user: {
        sub: userId,
        role: UserRole.USER,
        scope: UserLoginScope.FULL_ACCESS,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    } as unknown as ContextWithUser
    const input = {
      status: ElementStatus.READY,
      type: ElementType.QR_SCAN,
      name: 'QR room clue',
      content: 'Find and scan the hidden code.',
      explanation: null,
      basePoints: true,
      pointsMultiplier: 1,
      tags: [],
    }

    const created = await manipulateElement(input, ctx)
    const createdCode = await getQrScanCode({ elementId: created!.id }, ctx)
    const edited = await manipulateElement(
      { ...input, id: created!.id, name: 'Edited QR room clue' },
      ctx
    )
    const editedCode = await getQrScanCode({ elementId: edited!.id }, ctx)
    const duplicate = await manipulateElement(
      { ...input, name: 'Duplicated QR room clue' },
      ctx
    )
    const duplicateCode = await getQrScanCode({ elementId: duplicate!.id }, ctx)

    expect(createdCode).toMatch(/^[A-Za-z0-9_-]{12}$/)
    expect(editedCode).toBe(createdCode)
    expect(duplicateCode).toMatch(/^[A-Za-z0-9_-]{12}$/)
    expect(duplicateCode).not.toBe(createdCode)

    const contentElement = await prisma.element.create({
      data: {
        type: ElementType.CONTENT,
        status: ElementStatus.READY,
        name: 'Ordinary content',
        content: 'Not a QR element',
        basePoints: false,
        pointsMultiplier: 1,
        options: {},
        ownerId: userId,
      },
    })
    await expect(
      manipulateElement({ ...input, id: contentElement.id }, ctx)
    ).resolves.toBeNull()
    await expect(
      prisma.element.findUniqueOrThrow({ where: { id: contentElement.id } })
    ).resolves.toMatchObject({ type: ElementType.CONTENT, options: {} })
  })
})
