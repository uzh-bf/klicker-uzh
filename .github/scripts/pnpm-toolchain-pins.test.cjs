const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

const { PNPM_VERSION } = require('./playwright-cache-contract.cjs')

const root = path.resolve(__dirname, '../..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const manifest = JSON.parse(read('package.json'))
const version = manifest.packageManager?.match(/^pnpm@(\d+\.\d+\.\d+)$/)?.[1]
const files = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean)

test('root, Volta, asdf, and the Playwright cache agree on one exact pnpm version', () => {
  assert.ok(version, 'packageManager must pin a stable, exact pnpm version')
  assert.equal(manifest.volta.pnpm, version)
  assert.equal(read('.tool-versions').match(/^pnpm (\S+)$/m)?.[1], version)
  assert.equal(PNPM_VERSION, version)
})

test('Docker installs, package manifests, and current runtime fixtures use the root pnpm pin', () => {
  const pinFiles = files.filter(
    (file) =>
      /(^|\/)Dockerfile(?:\.[^/]*)?$/.test(file) ||
      path.basename(file) === 'package.json' ||
      /^util\/test-[^/]+\.sh$/.test(file)
  )
  let pins = 0
  for (const file of pinFiles) {
    const source = read(file)
    for (const match of source.matchAll(/\bpnpm@([^\s"'`;]+)/g)) {
      assert.equal(match[1], version, `${file} has a mismatched pnpm pin`)
      pins += 1
    }
    if (path.basename(file) === 'package.json') {
      const packageManifest = JSON.parse(source)
      if (packageManifest.volta?.pnpm) {
        assert.equal(packageManifest.volta.pnpm, version, file)
      }
    }
  }
  assert.ok(pins > 0, 'must inspect executable pnpm installation pins')
})

test('every workflow and composite action installs the root pnpm version', () => {
  const actionFiles = files.filter((file) =>
    /^\.github\/(?:actions|workflows)\/.*\.ya?ml$/.test(file)
  )
  let setups = 0
  for (const file of actionFiles) {
    const configuration = YAML.parse(read(file))
    const steps = [
      ...(configuration.runs?.steps ?? []),
      ...Object.values(configuration.jobs ?? {}).flatMap(
        (job) => job.steps ?? []
      ),
    ]
    for (const step of steps) {
      if (!step.uses?.startsWith('pnpm/action-setup@')) continue
      // Omitting version delegates to packageManager, which is safe across
      // candidate revisions when a composite action comes from trusted v3.
      assert.equal(step.with?.version ?? version, version, file)
      setups += 1
    }
  }
  assert.ok(setups > 0, 'must inspect pnpm/action-setup callers')
})

test('container lifecycle preserves fail-closed dependency verification', () => {
  assert.equal(
    YAML.parse(read('pnpm-workspace.yaml')).verifyDepsBeforeRun,
    'error'
  )
  for (const script of ['post-create', 'post-start', 'recover-bootstrap']) {
    const source = read(`.devcontainer/${script}.sh`)
    assert.doesNotMatch(
      source,
      /(?:npm|pnpm)_config_verify_deps_before_run\s*=/,
      `${script} must inherit the workspace policy`
    )
    if (script === 'post-start') continue
    const install = source.indexOf('\npnpm install ')
    const build = source.indexOf('\npnpm exec turbo run build')
    assert.ok(
      install >= 0 && build > install,
      `${script} installs before build`
    )
  }
})
