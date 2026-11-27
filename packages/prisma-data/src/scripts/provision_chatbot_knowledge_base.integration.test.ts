import { execFile, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * End-to-end coverage of provision_chatbot_knowledge_base against a
 * disposable database. Without TEST_DATABASE_URL the suite is skipped; the
 * pure projection and refusal logic is covered by the unit suite next to it.
 */
const DATABASE_URL = process.env.TEST_DATABASE_URL
const SCRIPT_DIRECTORY = fileURLToPath(new URL('.', import.meta.url))
const SPAWN_TIMEOUT = 60000

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const OWNER_EMAIL = 'synthetic-owner@synthetic.invalid'
const OTHER_OWNER_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_OWNER_EMAIL = 'synthetic-other@synthetic.invalid'
const COURSE_ID = '33333333-3333-4333-8333-333333333333'
const CHATBOT_ID = '44444444-4444-4444-8444-444444444444'
const KB_ID = '55555555-5555-4555-8555-555555555555'
const FOREIGN_KB_ID = '66666666-6666-4666-8666-666666666666'
const CONFLICT_KB_ID = '77777777-7777-4777-8777-777777777777'
const KB_SERVER_ID = '88888888-8888-4888-8888-888888888888'
const LEGACY_SERVER_ID = '99999999-9999-4999-8999-999999999999'
const TUTOR_CONFIG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const EXPLAINER_CONFIG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const LEGACY_CONFIG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const KB_NAME = 'Synthetic Provision Scope KB'
const LEGACY_SERVER_NAME = 'Synthetic Legacy Doc Query'
const DOC_QUERY_TOOL_ALIAS = 'doc_query'
const PHANTOM_KB_PARAMETERS = {
  kb_id: KB_ID,
  required: true,
  toolAlias: DOC_QUERY_TOOL_ALIAS,
}

const describeWithDatabase = DATABASE_URL ? describe : describe.skip

describeWithDatabase('provision_chatbot_knowledge_base script', () => {
  let prisma: PrismaClient
  let snapshotPath = ''
  let kbServerId = KB_SERVER_ID

  const runScript = (args: Array<string>, allowSecondaryLinks = false) =>
    execFileSync(
      process.execPath,
      [
        '../../node_modules/tsx/dist/cli.mjs',
        'provision_chatbot_knowledge_base.ts',
        ...args,
      ],
      {
        cwd: SCRIPT_DIRECTORY,
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_URL,
          PER_MODE_KB_LINKS_ENABLED: String(allowSecondaryLinks),
        },
        timeout: SPAWN_TIMEOUT,
      }
    )

  const runFailingScript = (
    args: Array<string>,
    allowSecondaryLinks = false
  ) => {
    try {
      return runScript(args, allowSecondaryLinks)
    } catch (error) {
      return String((error as { stdout?: Buffer | string }).stdout ?? '')
    }
  }

  const baseArgs = [
    '--chatbot-id',
    CHATBOT_ID,
    '--kb-id',
    KB_ID,
    '--kb-name',
    KB_NAME,
    '--owner',
    OWNER_EMAIL,
    '--legacy-server',
    LEGACY_SERVER_NAME,
  ]

  beforeAll(async () => {
    prisma = await createDisposableTestPrismaClient(DATABASE_URL as string)
    await requireDisposableDatabase(prisma)
    snapshotPath = join(mkdtempSync(join(tmpdir(), 'rsv-kb-')), 'snapshot.json')
    await prisma.user.createMany({
      data: [
        { id: OWNER_ID, email: OWNER_EMAIL, shortname: 'synthscopeowner' },
        {
          id: OTHER_OWNER_ID,
          email: OTHER_OWNER_EMAIL,
          shortname: 'synthscopeother',
        },
      ],
    })
    await prisma.course.create({
      data: {
        id: COURSE_ID,
        name: 'Synthetic Provision Scope Course',
        displayName: 'Synthetic Provision Scope Course',
        ownerId: OWNER_ID,
        pinCode: 987654,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        groupDeadlineDate: new Date(Date.now() + 20 * 24 * 3600 * 1000),
      },
    })
    await prisma.chatbot.create({
      data: {
        id: CHATBOT_ID,
        name: 'Synthetic Provision Scope Chatbot',
        ownerId: OWNER_ID,
        courseId: COURSE_ID,
      },
    })
    const kbServer = await prisma.chatbotMCPServer.upsert({
      where: { name: 'KB' },
      create: {
        id: KB_SERVER_ID,
        name: 'KB',
        url: 'http://synthetic.invalid/mcp/kb',
        authType: 'scope_token',
      },
      update: {},
      select: { id: true },
    })
    kbServerId = kbServer.id
    await prisma.chatbotMCPServer.create({
      data: {
        id: LEGACY_SERVER_ID,
        name: LEGACY_SERVER_NAME,
        url: 'http://synthetic.invalid/mcp/legacy',
        authType: 'none',
      },
    })
    await prisma.chatbotMCPConfig.createMany({
      data: [
        {
          id: TUTOR_CONFIG_ID,
          chatbotId: CHATBOT_ID,
          mcpServerId: kbServerId,
          chatMode: 'tutor',
          allowedTools: [DOC_QUERY_TOOL_ALIAS],
          parameters: PHANTOM_KB_PARAMETERS,
        },
        {
          id: EXPLAINER_CONFIG_ID,
          chatbotId: CHATBOT_ID,
          mcpServerId: kbServerId,
          chatMode: 'explainer',
          allowedTools: [DOC_QUERY_TOOL_ALIAS],
          parameters: PHANTOM_KB_PARAMETERS,
        },
        {
          id: LEGACY_CONFIG_ID,
          chatbotId: CHATBOT_ID,
          mcpServerId: LEGACY_SERVER_ID,
          chatMode: 'tutor',
          allowedTools: ['synthetic_legacy'],
          parameters: {},
        },
      ],
    })
  }, SPAWN_TIMEOUT)

  afterAll(async () => {
    await prisma.chatbotMCPConfig.deleteMany({
      where: { chatbotId: CHATBOT_ID },
    })
    await prisma.kBChatbot.deleteMany({ where: { chatbotId: CHATBOT_ID } })
    await prisma.chatbotMCPServer.deleteMany({
      where: { id: { in: [KB_SERVER_ID, LEGACY_SERVER_ID] } },
    })
    await prisma.kB.deleteMany({
      where: { id: { in: [KB_ID, FOREIGN_KB_ID, CONFLICT_KB_ID] } },
    })
    await prisma.chatbot.deleteMany({ where: { id: CHATBOT_ID } })
    await prisma.course.deleteMany({ where: { id: COURSE_ID } })
    await prisma.user.deleteMany({
      where: { id: { in: [OWNER_ID, OTHER_OWNER_ID] } },
    })
    await prisma.$disconnect()
  }, SPAWN_TIMEOUT)

  it(
    'waits for a concurrent last-slot writer and refuses to add a 33rd link',
    async () => {
      const ids = Array.from({ length: 32 }, () => randomUUID())
      const snapshot = join(tmpdir(), `provision-${randomUUID()}.json`)
      await prisma.kB.createMany({
        data: ids.map((id) => ({
          id,
          name: `Capacity ${id}`,
          ownerId: OWNER_ID,
        })),
      })
      let result: Promise<{ code: number; stdout: string }> | undefined
      try {
        await prisma.kBChatbot.createMany({
          data: ids
            .slice(0, 31)
            .map((kbId) => ({ kbId, chatbotId: CHATBOT_ID, isEnabled: true })),
        })
        await prisma.$transaction(
          async (tx) => {
            const backend = await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`
            await tx.chatbot.update({
              where: { id: CHATBOT_ID },
              data: { updatedAt: new Date() },
            })
            await tx.kBChatbot.create({
              data: { chatbotId: CHATBOT_ID, kbId: ids[31]!, isEnabled: true },
            })
            result = promisify(execFile)(
              process.execPath,
              [
                '../../node_modules/tsx/dist/cli.mjs',
                'provision_chatbot_knowledge_base.ts',
                ...baseArgs,
                '--apply',
                '--snapshot-out',
                snapshot,
              ],
              {
                cwd: SCRIPT_DIRECTORY,
                encoding: 'utf8',
                timeout: SPAWN_TIMEOUT,
                env: {
                  ...process.env,
                  DATABASE_URL,
                  PER_MODE_KB_LINKS_ENABLED: 'true',
                },
              }
            ).then(
              ({ stdout }) => ({ code: 0, stdout }),
              (error) => ({ code: error.code, stdout: error.stdout })
            )

            // Release the final slot only once the provisioner is waiting on this transaction.
            await expect
              .poll(
                async () => {
                  const [row] = await prisma.$queryRaw<{ waiting: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity WHERE ${backend[0]!.pid}::int = ANY(pg_blocking_pids(pid))
            ) AS waiting`
                  return row?.waiting
                },
                { timeout: 15000 }
              )
              .toBe(true)
          },
          { timeout: 25000 }
        )
        expect(await result).toMatchObject({
          code: 1,
          stdout: expect.stringContaining('link_limit_reached'),
        })
        expect(
          await prisma.kBChatbot.count({
            where: { chatbotId: CHATBOT_ID, isEnabled: true },
          })
        ).toBe(32)
      } finally {
        await result
        await prisma.kB.deleteMany({ where: { id: { in: ids } } })
      }
    },
    SPAWN_TIMEOUT
  )

  it(
    'refuses an unknown owner without writing',
    async () => {
      const output = runFailingScript(
        baseArgs.map((entry) =>
          entry === OWNER_EMAIL ? 'unknown@synthetic.invalid' : entry
        )
      )
      expect(output).toContain('FAIL: owner_not_found')
      expect(await prisma.kB.count({ where: { id: KB_ID } })).toBe(0)
    },
    SPAWN_TIMEOUT
  )

  it(
    'refuses an owner who owns neither chatbot nor course',
    async () => {
      const output = runFailingScript(
        baseArgs.map((entry) =>
          entry === OWNER_EMAIL ? OTHER_OWNER_EMAIL : entry
        )
      )
      expect(output).toContain('FAIL: owner_not_chatbot_owner')
      expect(await prisma.kBChatbot.count({ where: { kbId: KB_ID } })).toBe(0)
    },
    SPAWN_TIMEOUT
  )

  it(
    'refuses a knowledge base owned by someone else',
    async () => {
      await prisma.kB.create({
        data: { id: KB_ID, name: KB_NAME, ownerId: OTHER_OWNER_ID },
      })
      try {
        const output = runFailingScript(baseArgs)
        expect(output).toContain('FAIL: kb_owner_mismatch')
      } finally {
        await prisma.kB.deleteMany({ where: { id: KB_ID } })
      }
    },
    SPAWN_TIMEOUT
  )

  it(
    'refuses a knowledge base name already owned by another row',
    async () => {
      await prisma.kB.create({
        data: {
          id: CONFLICT_KB_ID,
          name: KB_NAME,
          ownerId: OTHER_OWNER_ID,
        },
      })
      try {
        const output = runFailingScript(baseArgs)
        expect(output).toContain('FAIL: kb_name_conflict')
      } finally {
        await prisma.kB.deleteMany({ where: { id: CONFLICT_KB_ID } })
      }
    },
    SPAWN_TIMEOUT
  )

  it(
    'adds the target as default and preserves an enabled secondary link',
    async () => {
      const additiveSnapshot = join(
        mkdtempSync(join(tmpdir(), 'rsv-kb-additive-')),
        'snapshot.json'
      )
      await prisma.kB.create({
        data: {
          id: FOREIGN_KB_ID,
          name: 'Synthetic Foreign Scope KB',
          ownerId: OWNER_ID,
        },
      })
      await prisma.kBChatbot.create({
        data: {
          kbId: FOREIGN_KB_ID,
          chatbotId: CHATBOT_ID,
          isEnabled: true,
          isDefault: true,
        },
      })
      try {
        const output = runScript(
          [...baseArgs, '--snapshot-out', additiveSnapshot, '--apply'],
          true
        )
        expect(output).toContain('APPLIED')

        const links = await prisma.kBChatbot.findMany({
          where: { chatbotId: CHATBOT_ID },
        })
        expect(links.find(({ kbId }) => kbId === KB_ID)).toMatchObject({
          isEnabled: true,
          isDefault: true,
        })
        expect(links.find(({ kbId }) => kbId === FOREIGN_KB_ID)).toMatchObject({
          isEnabled: true,
          isDefault: false,
        })
        expect(
          await prisma.kBChatbot.count({
            where: { chatbotId: CHATBOT_ID, isDefault: true },
          })
        ).toBe(1)

        runScript(['--rollback', '--snapshot', additiveSnapshot])
        expect(
          await prisma.kBChatbot.count({
            where: { chatbotId: CHATBOT_ID, kbId: KB_ID },
          })
        ).toBe(0)
        expect(await prisma.kB.count({ where: { id: KB_ID } })).toBe(0)
        expect(
          await prisma.kBChatbot.findUnique({
            where: {
              kbId_chatbotId: {
                kbId: FOREIGN_KB_ID,
                chatbotId: CHATBOT_ID,
              },
            },
          })
        ).toMatchObject({ isEnabled: true, isDefault: true })
      } finally {
        await prisma.kBChatbot.deleteMany({
          where: { kbId: FOREIGN_KB_ID, chatbotId: CHATBOT_ID },
        })
        await prisma.kB.deleteMany({ where: { id: FOREIGN_KB_ID } })
      }
    },
    SPAWN_TIMEOUT
  )

  it(
    'replaces a disabled historical link with a fresh default link',
    async () => {
      const disabledSnapshot = join(
        mkdtempSync(join(tmpdir(), 'rsv-kb-disabled-')),
        'snapshot.json'
      )
      const historicalId = randomUUID()
      await prisma.kB.create({
        data: { id: KB_ID, name: KB_NAME, ownerId: OWNER_ID },
      })
      await prisma.kBChatbot.create({
        data: {
          id: historicalId,
          kbId: KB_ID,
          chatbotId: CHATBOT_ID,
          isEnabled: false,
          isDefault: false,
        },
      })
      try {
        runScript([...baseArgs, '--snapshot-out', disabledSnapshot, '--apply'])
        const replacement = await prisma.kBChatbot.findUniqueOrThrow({
          where: {
            kbId_chatbotId: { kbId: KB_ID, chatbotId: CHATBOT_ID },
          },
        })
        expect(replacement.id).not.toBe(historicalId)
        expect(replacement).toMatchObject({
          isEnabled: true,
          isDefault: true,
        })

        expect(
          runScript(['--rollback', '--snapshot', disabledSnapshot])
        ).toContain('bindingRestored=true')
        expect(
          await prisma.kBChatbot.findUnique({
            where: {
              kbId_chatbotId: { kbId: KB_ID, chatbotId: CHATBOT_ID },
            },
          })
        ).toMatchObject({
          id: historicalId,
          isEnabled: false,
          isDefault: false,
        })
      } finally {
        await prisma.kBChatbot.deleteMany({
          where: { chatbotId: CHATBOT_ID, kbId: KB_ID },
        })
        await prisma.kB.deleteMany({ where: { id: KB_ID } })
      }
    },
    SPAWN_TIMEOUT
  )

  it(
    'dry run prints the plan and writes nothing',
    async () => {
      const output = runScript(baseArgs)
      expect(output).toContain('action=create_kb')
      expect(output).toContain('action=create_binding')
      expect(output).toContain('changed=false')
      expect(output).toContain('action=disable_legacy_config')
      expect(output).toContain('action=deactivate_legacy_server')
      expect(output).toContain('Dry run only')
      expect(await prisma.kB.count({ where: { id: KB_ID } })).toBe(0)
    },
    SPAWN_TIMEOUT
  )

  it(
    'refuses an apply without a snapshot path',
    () => {
      expect(runFailingScript([...baseArgs, '--apply'])).toContain(
        '--apply requires --snapshot-out'
      )
    },
    SPAWN_TIMEOUT
  )

  it(
    'applies the knowledge base, the binding and the scope projection',
    async () => {
      const output = runScript([
        ...baseArgs,
        '--description',
        'Synthetic provisioned scope',
        '--snapshot-out',
        snapshotPath,
        '--apply',
      ])
      expect(output).toContain('APPLIED')

      const kb = await prisma.kB.findUniqueOrThrow({ where: { id: KB_ID } })
      expect(kb).toMatchObject({
        name: KB_NAME,
        ownerId: OWNER_ID,
        description: 'Synthetic provisioned scope',
        deletedAt: null,
      })
      const binding = await prisma.kBChatbot.findUniqueOrThrow({
        where: { kbId_chatbotId: { kbId: KB_ID, chatbotId: CHATBOT_ID } },
      })
      expect(binding).toMatchObject({ isEnabled: true, isDefault: true })
      expect(
        await prisma.kBChatbot.count({
          where: { chatbotId: CHATBOT_ID, isDefault: true },
        })
      ).toBe(1)

      const configs = await prisma.chatbotMCPConfig.findMany({
        where: { chatbotId: CHATBOT_ID, mcpServerId: kbServerId },
        orderBy: { chatMode: 'asc' },
      })
      expect(configs).toHaveLength(2)
      for (const config of configs) {
        expect(config.isEnabled).toBe(true)
        expect(config.allowedTools).toEqual([DOC_QUERY_TOOL_ALIAS])
        expect(config.parameters).toEqual(PHANTOM_KB_PARAMETERS)
      }

      const legacyConfig = await prisma.chatbotMCPConfig.findUniqueOrThrow({
        where: { id: LEGACY_CONFIG_ID },
      })
      expect(legacyConfig.isEnabled).toBe(false)
      const legacyServer = await prisma.chatbotMCPServer.findUniqueOrThrow({
        where: { id: LEGACY_SERVER_ID },
      })
      expect(legacyServer.isActive).toBe(false)
      expect(JSON.parse(readFileSync(snapshotPath, 'utf8'))).toMatchObject({
        chatbotId: CHATBOT_ID,
        kbId: KB_ID,
        kbWasCreated: true,
        binding: null,
      })
    },
    SPAWN_TIMEOUT
  )

  it(
    'replays without creating a second knowledge base or binding',
    async () => {
      const replaySnapshot = `${snapshotPath}.replay`
      const output = runScript([
        ...baseArgs,
        '--snapshot-out',
        replaySnapshot,
        '--apply',
      ])
      expect(output).toContain('action=none')
      expect(output).toContain('APPLIED')
      expect(await prisma.kB.count({ where: { id: KB_ID } })).toBe(1)
      expect(await prisma.kBChatbot.count({ where: { kbId: KB_ID } })).toBe(1)
      expect(JSON.parse(readFileSync(replaySnapshot, 'utf8'))).toMatchObject({
        kbWasCreated: false,
        binding: { isEnabled: true },
        bindings: [{ isEnabled: true, isDefault: true }],
      })
    },
    SPAWN_TIMEOUT
  )

  it(
    'restores the pre-apply state on rollback',
    async () => {
      const output = runScript(['--rollback', '--snapshot', snapshotPath])
      expect(output).toContain('ROLLED_BACK')
      expect(output).toContain('kbRemoved=true')

      expect(await prisma.kB.count({ where: { id: KB_ID } })).toBe(0)
      expect(await prisma.kBChatbot.count({ where: { kbId: KB_ID } })).toBe(0)
      const configs = await prisma.chatbotMCPConfig.findMany({
        where: { chatbotId: CHATBOT_ID, mcpServerId: kbServerId },
      })
      for (const config of configs) {
        expect(config.isEnabled).toBe(true)
        expect(config.parameters).toEqual(PHANTOM_KB_PARAMETERS)
      }
      const legacyConfig = await prisma.chatbotMCPConfig.findUniqueOrThrow({
        where: { id: LEGACY_CONFIG_ID },
      })
      expect(legacyConfig.isEnabled).toBe(true)
      const legacyServer = await prisma.chatbotMCPServer.findUniqueOrThrow({
        where: { id: LEGACY_SERVER_ID },
      })
      expect(legacyServer.isActive).toBe(true)
    },
    SPAWN_TIMEOUT
  )

  it(
    'refuses a thirty-third enabled link without creating a target row',
    async () => {
      const capKbIds = Array.from({ length: 32 }, () => randomUUID())
      await prisma.kB.createMany({
        data: capKbIds.map((id, index) => ({
          id,
          name: 'Synthetic Cap KB ' + index,
          ownerId: OWNER_ID,
        })),
      })
      await prisma.kBChatbot.createMany({
        data: capKbIds.map((kbId, index) => ({
          kbId,
          chatbotId: CHATBOT_ID,
          isEnabled: true,
          isDefault: index === 0,
        })),
      })
      try {
        const output = runFailingScript(baseArgs, true)
        expect(output).toContain('FAIL: link_limit_reached')
        expect(await prisma.kB.count({ where: { id: KB_ID } })).toBe(0)
        expect(
          await prisma.kBChatbot.count({ where: { chatbotId: CHATBOT_ID } })
        ).toBe(32)
      } finally {
        await prisma.kBChatbot.deleteMany({
          where: { chatbotId: CHATBOT_ID, kbId: { in: capKbIds } },
        })
        await prisma.kB.deleteMany({ where: { id: { in: capKbIds } } })
      }
    },
    SPAWN_TIMEOUT
  )
})
