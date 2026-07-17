import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createKb,
  deleteKb,
  getKb,
  getUserKbs,
} from '../src/services/knowledge.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('Integration tests for knowledge base CRUD', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
  })

  afterEach(async () => await testCleanup(prisma))

  it('creates and lists only the current users knowledge bases', async () => {
    const created = await createKb(
      { name: 'Finance notes', description: 'Course material' },
      userOneCtx
    )
    await createKb({ name: 'Other owner' }, userTwoCtx)

    const userKbs = await getUserKbs(userOneCtx)

    expect(userKbs).toHaveLength(1)
    expect(userKbs[0]).toMatchObject({
      id: created.id,
      name: 'Finance notes',
      description: 'Course material',
      ownerId: userOneCtx.user.sub,
    })
  })

  it('returns an owned knowledge base with its resources', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)

    const kb = await getKb({ id: created.id }, userOneCtx)

    expect(kb.id).toBe(created.id)
    expect(kb.resources).toEqual([])
  })

  it('rejects an empty knowledge base name', async () => {
    await expect(createKb({ name: '   ' }, userOneCtx)).rejects.toThrow(
      'KB name is required'
    )

    await expect(getUserKbs(userOneCtx)).resolves.toEqual([])
  })

  it('deletes an owned knowledge base', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)

    await deleteKb({ id: created.id }, userOneCtx)

    await expect(
      prisma.kB.findUnique({ where: { id: created.id } })
    ).resolves.toBeNull()
  })

  it('denies reads and deletion to a foreign owner without revealing existence', async () => {
    const created = await createKb({ name: 'Private notes' }, userOneCtx)

    await expect(getKb({ id: created.id }, userTwoCtx)).rejects.toThrow(
      'KB not found'
    )
    await expect(deleteKb({ id: created.id }, userTwoCtx)).rejects.toThrow(
      'KB not found'
    )
    await expect(
      prisma.kB.findUnique({ where: { id: created.id } })
    ).resolves.toBeTruthy()
  })
})
