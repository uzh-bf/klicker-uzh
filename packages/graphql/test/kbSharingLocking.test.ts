import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  PermissionLevel,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../src/lib/context.js'
import { updateKb } from '../src/services/knowledge.js'
import {
  createUserGroup,
  revokeObjectAccess,
  shareObject,
} from '../src/services/sharing.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userTwo } from './userData.js'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function withPermissionDeletePause(
  ctx: ContextWithUser,
  onDeleted: (blockerPid: number) => void,
  continueDelete: Promise<void>
): ContextWithUser {
  let blockerPid: number | undefined
  const queryClient = ctx.prisma.$extends({
    query: {
      permission: {
        async delete({ args, query }) {
          const result = await query(args)
          if (typeof blockerPid !== 'number') {
            throw new Error('Missing revocation transaction backend id')
          }
          onDeleted(blockerPid)
          await continueDelete
          return result
        },
      },
    },
  })
  const prisma = queryClient.$extends({
    client: {
      async $transaction<T>(
        operation: (transaction: Prisma.TransactionClient) => Promise<T>,
        options?: {
          isolationLevel?: Prisma.TransactionIsolationLevel
          maxWait?: number
          timeout?: number
        }
      ) {
        return queryClient.$transaction(async (transaction) => {
          const [backend] = await transaction.$queryRaw<
            Array<{ pid: number }>
          >`SELECT pg_backend_pid() AS pid`
          blockerPid = backend!.pid
          return operation(transaction as unknown as Prisma.TransactionClient)
        }, options)
      },
    },
  }) as unknown as PrismaClient

  return { ...ctx, prisma }
}

async function bounded<T>(
  promise: Promise<T>,
  description: string,
  timeoutMs = 5000
) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${description}`)),
      timeoutMs
    )
  })
  try {
    return await Promise.race([promise, deadline])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function waitForLockWait(
  prisma: PrismaClient,
  blockerPid: number,
  queryFragment: string
) {
  const deadline = Date.now() + 4000
  while (Date.now() < deadline) {
    const [waiter] = await prisma.$queryRaw<Array<{ pid: number }>>`
      SELECT pid
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND ${blockerPid} = ANY(pg_blocking_pids(pid))
        AND position(${queryFragment} in query) > 0
      LIMIT 1
    `
    if (waiter) return waiter.pid
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  throw new Error('Timed out waiting for the expected PostgreSQL lock wait')
}

describe('Knowledge base sharing transaction locks', () => {
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
    await prisma.user.updateMany({
      where: { id: { in: [userOneCtx.user.sub, userTwoCtx.user.sub] } },
      data: { aiFeaturesEnabled: true, betaEnabled: true },
    })
  })

  afterEach(async () => await testCleanup(prisma))

  it('lets revocation recompute finish against a concurrent shared write', async () => {
    const kb = await prisma.kB.create({
      data: { name: 'Shared lock regression', ownerId: userOneCtx.user.sub },
    })
    const group = await createUserGroup(
      {
        name: 'KB lock regression group',
        members: [{ shortnameOrEmail: userTwo.shortname }],
      },
      userOneCtx
    )
    await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        propagation: false,
      },
      userOneCtx
    )
    const groupPermission = await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group!.id,
        propagation: false,
      },
      userOneCtx
    )

    const permissionDeleted = createDeferred<number>()
    const continueDelete = createDeferred<void>()
    const revokeCtx = withPermissionDeletePause(
      userOneCtx,
      permissionDeleted.resolve,
      continueDelete.promise
    )

    let revocation: ReturnType<typeof revokeObjectAccess> | undefined
    let liveWrite: ReturnType<typeof updateKb> | undefined
    try {
      revocation = revokeObjectAccess(
        { permissionId: groupPermission!.permissionId, kbId: kb.id },
        revokeCtx
      )
      const blockerPid = await bounded(
        permissionDeleted.promise,
        'the paused revocation transaction'
      )
      liveWrite = updateKb(
        { id: kb.id, name: 'Written while revoking' },
        userTwoCtx
      )

      await waitForLockWait(
        prisma,
        blockerPid,
        'FROM "public"."DerivedPermission"'
      )
      continueDelete.resolve(undefined)

      const [revocationResult, liveWriteResult] = await Promise.allSettled([
        revocation,
        liveWrite,
      ])
      expect(revocationResult).toEqual({
        status: 'fulfilled',
        value: groupPermission!.permissionId,
      })
      expect(liveWriteResult).toEqual({
        status: 'rejected',
        reason: expect.objectContaining({ message: 'KB not found' }),
      })
    } finally {
      continueDelete.resolve(undefined)
      const pendingOperations: Array<Promise<unknown>> = []
      if (revocation) pendingOperations.push(revocation)
      if (liveWrite) pendingOperations.push(liveWrite)
      await Promise.allSettled(pendingOperations)
    }

    await expect(
      prisma.permission.findUnique({
        where: { id: groupPermission!.permissionId },
      })
    ).resolves.toBeNull()
    await expect(
      prisma.derivedPermission.findUnique({
        where: { kbId_userId: { kbId: kb.id, userId: userTwoCtx.user.sub } },
      })
    ).resolves.toMatchObject({ permissionLevel: PermissionLevel.READ })
    await expect(
      prisma.kB.findUniqueOrThrow({ where: { id: kb.id } })
    ).resolves.toMatchObject({ name: 'Shared lock regression' })
  })
})
