import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const runnerPath = fileURLToPath(
  new URL('../../../util/import-export-backfill.sh', import.meta.url)
)
const repositoryRoot = dirname(dirname(runnerPath))
const tempDirectories: string[] = []

type Harness = Awaited<ReturnType<typeof createHarness>>

async function createHarness() {
  const root = await mkdtemp(join(tmpdir(), 'klicker-backfill-runner-'))
  tempDirectories.push(root)
  const home = join(root, 'home')
  const bin = join(root, 'bin')
  const log = join(root, 'pnpm.log')
  await Promise.all([mkdir(home), mkdir(bin)])
  const canonicalHome = await realpath(home)

  const fakePnpm = join(bin, 'pnpm')
  await writeFile(
    fakePnpm,
    `#!/usr/bin/env bash
set -euo pipefail
operation="\${!#}"
printf '%s|%s|%s\n' "$operation" "\${IMPORT_EXPORT_PROGRESS_MANIFEST_PATH:-}" "\${IMPORT_EXPORT_RESUME_MANIFEST_PATH:-}" >> "$FAKE_PNPM_LOG"
if [[ -n "\${IMPORT_EXPORT_PROGRESS_MANIFEST_PATH:-}" ]]; then
  printf '{}\n' > "$IMPORT_EXPORT_PROGRESS_MANIFEST_PATH"
  chmod 600 "$IMPORT_EXPORT_PROGRESS_MANIFEST_PATH"
fi
if [[ "$operation" == "\${FAKE_PNPM_STOP_OPERATION:-}" ]]; then
  exit "\${FAKE_PNPM_STOP_STATUS:-1}"
fi
`,
    { mode: 0o700 }
  )
  await chmod(fakePnpm, 0o700)

  return { root, home: canonicalHome, bin, log }
}

function run(
  harness: Harness,
  args: string[],
  overrides: NodeJS.ProcessEnv = {},
  scriptPath = runnerPath
) {
  return spawnSync('bash', [scriptPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: harness.home,
      PATH: `${harness.bin}:${process.env.PATH ?? ''}`,
      FAKE_PNPM_LOG: harness.log,
      ...overrides,
    },
  })
}

async function logLines(harness: Harness) {
  if (!existsSync(harness.log)) return []
  return (await readFile(harness.log, 'utf8')).trim().split('\n')
}

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('guarded import/export backfill runner', () => {
  it('rejects invalid or extra arguments before invoking pnpm', async () => {
    const harness = await createHarness()

    expect(run(harness, ['qa']).status).toBe(1)
    expect(run(harness, ['stg', 'extra']).status).toBe(1)
    expect(await logLines(harness)).toEqual([])
  })

  it('runs media, didactic fingerprints, and verification in order with private state', async () => {
    const harness = await createHarness()
    const result = run(harness, ['stg'])
    const stateDirectory = join(
      harness.home,
      '.klicker/import-export-backfill/stg'
    )
    const mediaManifest = join(stateDirectory, 'media-progress.json')
    const fingerprintManifest = join(
      stateDirectory,
      'fingerprint-progress.json'
    )

    expect(result.status, result.stderr).toBe(0)
    expect(await logLines(harness)).toEqual([
      `script:import-export-media-hash-backfill:stg|${mediaManifest}|`,
      `script:import-export-fingerprint-backfill:stg|${fingerprintManifest}|`,
      'script:import-export-backfill-verify:stg||',
    ])
    expect((await stat(stateDirectory)).mode & 0o777).toBe(0o700)
    expect((await stat(mediaManifest)).mode & 0o777).toBe(0o600)
    expect((await stat(fingerprintManifest)).mode & 0o777).toBe(0o600)
  })

  it('propagates a bounded stop and resumes from the protected manifest', async () => {
    const harness = await createHarness()
    const stopped = run(harness, ['prd'], {
      FAKE_PNPM_STOP_OPERATION: 'script:import-export-media-hash-backfill:prd',
      FAKE_PNPM_STOP_STATUS: '2',
    })

    expect(stopped.status, stopped.stderr).toBe(2)
    expect(stopped.stderr).toContain(
      'Backfill incomplete. Rerun: ./util/import-export-backfill.sh prd'
    )
    expect(await logLines(harness)).toHaveLength(1)

    await writeFile(harness.log, '')
    const resumed = run(harness, ['prd'])
    const mediaManifest = join(
      harness.home,
      '.klicker/import-export-backfill/prd/media-progress.json'
    )
    expect(resumed.status).toBe(0)
    expect((await logLines(harness))[0]).toBe(
      `script:import-export-media-hash-backfill:prd|${mediaManifest}|${mediaManifest}`
    )
  })

  it('does not verify after a bounded didactic-fingerprint stop', async () => {
    const harness = await createHarness()
    const result = run(harness, ['stg'], {
      FAKE_PNPM_STOP_OPERATION: 'script:import-export-fingerprint-backfill:stg',
      FAKE_PNPM_STOP_STATUS: '2',
    })

    expect(result.status, result.stderr).toBe(2)
    expect(await logLines(harness)).toHaveLength(2)
  })

  it('refuses repository state paths and symlinked manifests', async () => {
    const repositoryHarness = await createHarness()
    repositoryHarness.home = repositoryRoot
    expect(run(repositoryHarness, ['stg']).status).toBe(1)
    expect(await logLines(repositoryHarness)).toEqual([])

    const symlinkHarness = await createHarness()
    const stateDirectory = join(
      symlinkHarness.home,
      '.klicker/import-export-backfill/stg'
    )
    await mkdir(stateDirectory, { recursive: true })
    await symlink(
      join(symlinkHarness.root, 'manifest-target'),
      join(stateDirectory, 'media-progress.json')
    )
    expect(run(symlinkHarness, ['stg']).status).toBe(1)
    expect(await logLines(symlinkHarness)).toEqual([])
  })

  it('refuses lexical and pre-creation canonical repository state paths', async () => {
    const lexicalHarness = await createHarness()
    const lexicalRepository = join(lexicalHarness.root, 'repository')
    const lexicalRunner = join(
      lexicalRepository,
      'util/import-export-backfill.sh'
    )
    await mkdir(dirname(lexicalRunner), { recursive: true })
    await writeFile(lexicalRunner, await readFile(runnerPath), { mode: 0o700 })
    const lexicalHome = join(lexicalRepository, 'home-link')
    await symlink(lexicalHarness.home, lexicalHome)
    lexicalHarness.home = lexicalHome

    expect(run(lexicalHarness, ['stg'], {}, lexicalRunner).status).toBe(1)
    expect(await logLines(lexicalHarness)).toEqual([])

    const canonicalHarness = await createHarness()
    const canonicalRepository = join(canonicalHarness.root, 'repository')
    const canonicalRunner = join(
      canonicalRepository,
      'util/import-export-backfill.sh'
    )
    const repositoryStateRoot = join(canonicalRepository, 'state-root')
    await Promise.all([
      mkdir(dirname(canonicalRunner), { recursive: true }),
      mkdir(repositoryStateRoot, { recursive: true }),
    ])
    await writeFile(canonicalRunner, await readFile(runnerPath), {
      mode: 0o700,
    })
    await symlink(repositoryStateRoot, join(canonicalHarness.home, '.klicker'))

    expect(run(canonicalHarness, ['stg'], {}, canonicalRunner).status).toBe(1)
    expect(await logLines(canonicalHarness)).toEqual([])
    expect(
      existsSync(join(repositoryStateRoot, 'import-export-backfill'))
    ).toBe(false)
  })
})
