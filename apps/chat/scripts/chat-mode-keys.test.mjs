import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

import { CHAT_MODE_KEYS } from './chat-mode-keys.mjs'

// The synthetic clients cannot import the TypeScript mode registry, so this
// guard fails when a mode is added to or removed from the product registry
// without updating CHAT_MODE_KEYS.
test('the synthetic mode list matches the product mode registry', async () => {
  const registryPath = fileURLToPath(
    new URL('../src/lib/config/prompts.ts', import.meta.url)
  )
  const source = await readFile(registryPath, 'utf8')
  const block = source.match(/DEFAULT_PROMPT[^=]*=\s*\{([\s\S]*?)\n\}/)
  assert.ok(block, 'DEFAULT_PROMPT block was not found in prompts.ts')

  const keys = [...block[1].matchAll(/^\s{2}'?([a-z][a-z-]*)'?:\s*\{/gm)].map(
    (match) => match[1]
  )
  assert.deepEqual(keys.sort(), [...CHAT_MODE_KEYS].sort())
})
