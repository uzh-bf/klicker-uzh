import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  parseFinanceWikiAttachmentCliArgs,
  runFinanceWikiAttachmentCli,
} from './financewiki-attachment-run.js'

const acquireLock = vi.hoisted(() => vi.fn())
const applyAttachment = vi.hoisted(() => vi.fn())
vi.mock('./financewiki-attachment.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./financewiki-attachment.js')>()),
  applyFinanceWikiAttachment: applyAttachment,
}))
vi.mock('./doc-query-cohort-activation-run.js', () => ({
  acquireCohortActivationSessionLock: acquireLock,
}))

describe('FinanceWiki attachment CLI', () => {
  const paths = ['--manifest', 'manifest.json', '--receipt', 'receipt.json']

  it.each([
    undefined,
    'adopt',
    'remove',
  ] as const)('reports the requested operation for a no-op apply: %s', async (operation) => {
    const directory = await mkdtemp(join(tmpdir(), 'financewiki-cli-'))
    try {
      const manifest = join(directory, 'manifest.json')
      await writeFile(
        manifest,
        JSON.stringify({
          version: 1,
          operation,
          targets: [
            {
              chatbotId: '00000000-0000-4000-8000-000000000101',
              chatMode: 'tutor',
            },
          ],
        })
      )
      const release = vi.fn()
      acquireLock.mockResolvedValueOnce({ release })
      applyAttachment.mockResolvedValueOnce({ status: 'noop', receipt: null })
      const output: string[] = []
      const exitCode = await runFinanceWikiAttachmentCli(
        [
          'apply',
          '--manifest',
          manifest,
          '--receipt',
          join(directory, 'receipt.json'),
        ],
        { store: { transaction: vi.fn() }, write: (line) => output.push(line) }
      )
      expect(exitCode).toBe(0)
      expect(output).toHaveLength(1)
      expect(JSON.parse(output[0]!)).toEqual({
        status: 'noop',
        operation: operation ?? 'attach',
        targetCount: 0,
        receiptState: null,
      })
      expect(release).toHaveBeenCalledOnce()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('keeps plan as the default and accepts an explicit first action', () => {
    expect(parseFinanceWikiAttachmentCliArgs(paths).action).toBe('plan')
    expect(parseFinanceWikiAttachmentCliArgs(['plan', ...paths]).action).toBe(
      'plan'
    )
    expect(parseFinanceWikiAttachmentCliArgs(['apply', ...paths]).action).toBe(
      'apply'
    )
  })

  it.each([
    ['plan', 'plan', ...paths],
    ['apply', 'plan', ...paths],
    ['plan', 'apply', ...paths],
    [...paths, 'plan'],
  ])('rejects repeated or misplaced actions: %j', (...args) => {
    expect(() => parseFinanceWikiAttachmentCliArgs(args)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARGUMENTS' })
    )
  })

  it.each([
    ['SESSION_LOCKED', 'SESSION_LOCKED'],
    ['synthetic internal failure', 'OPERATION_FAILED'],
  ])('classifies lock acquisition failure %s as %s', async (message, code) => {
    acquireLock.mockRejectedValueOnce(new Error(message))
    const output: string[] = []
    const exitCode = await runFinanceWikiAttachmentCli(
      ['readback', '--receipt', 'receipt.json'],
      { write: (line) => output.push(line) }
    )
    expect(exitCode).toBe(1)
    expect(output).toHaveLength(1)
    expect(JSON.parse(output[0]!).error.code).toBe(code)
  })
})
