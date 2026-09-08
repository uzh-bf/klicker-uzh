import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('Hatchet setup is explicit, one-shot and keeps token output out of logs', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'kb-hatchet-test-')))
  const state = join(root, 'config')
  await mkdir(state)
  for (const [name, script] of Object.entries({
    'hatchet-migrate': '#!/bin/sh\necho migrate >> calls\n',
    'hatchet-admin':
      '#!/bin/sh\necho "$1" >> calls\nif [ "$1" = token ]; then echo synthetic-test-token; fi\n',
    'hatchet-lite': '#!/bin/sh\necho serve >> calls\n',
  })) {
    const path = join(root, name)
    await writeFile(path, script)
    await chmod(path, 0o700)
  }
  const run = (command) =>
    execFileSync(
      'bash',
      [
        fileURLToPath(new URL('./hatchet-entrypoint.sh', import.meta.url)),
        command,
      ],
      {
        cwd: root,
        env: { PATH: process.env.PATH, LOCAL_KB_HATCHET_CONFIG_DIR: state },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
  assert.throws(() => run('start'))
  assert.equal(run('setup'), '')
  assert.equal(
    await readFile(join(root, 'calls'), 'utf8'),
    'migrate\nquickstart\nauthdisabled\ntoken\n'
  )
  assert.throws(() => run('setup'))
  run('start')
  run('start')
  assert.equal(
    await readFile(join(root, 'calls'), 'utf8'),
    'migrate\nquickstart\nauthdisabled\ntoken\nserve\nserve\n'
  )
})
