import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  assertHostDependencies,
  checkTasks,
  cleanGitEnvironment,
  loadPrettier,
  runHook,
} from './run-git-hook.mjs'

const repositoryRoot = path.resolve(
  fileURLToPath(new URL('../', import.meta.url))
)
const fixtureBin = path.join(repositoryRoot, 'node_modules')
const { parseNameStatusRecords } = createRequire(import.meta.url)(
  '../.github/scripts/minimum-validation-class.cjs'
)

function writeFixtureFile(root, relativePath, source) {
  const absolute = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  fs.writeFileSync(absolute, source)
}

function copyFixtureFile(root, relativePath) {
  writeFixtureFile(
    root,
    relativePath,
    fs.readFileSync(path.join(repositoryRoot, relativePath))
  )
}

function commitFixtureFile(f, relativePath, source, message) {
  writeFixtureFile(f.root, relativePath, source)
  f.git('add', '--', relativePath)
  f.git('commit', '-q', '-m', message)
  return f.git('rev-parse', 'HEAD').trim()
}

function fixture(t, native = false, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-routing-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const bin = path.join(root, 'bin')
  fs.mkdirSync(bin)
  fs.mkdirSync(path.join(root, 'tmp'))
  const log = path.join(root, 'calls.jsonl')
  for (const command of ['devrouter', 'pnpm']) {
    fs.writeFileSync(
      path.join(bin, command),
      `#!${process.execPath}\nconst fs = require('node:fs'); fs.appendFileSync(process.env.HOOK_TEST_LOG, JSON.stringify({command:${JSON.stringify(command)}, args:process.argv.slice(2), git:Object.keys(process.env).filter(k=>k.startsWith('GIT_'))})+'\\n'); process.exit(Number(process.env.HOOK_TEST_EXIT || 0))\n`,
      { mode: 0o755 }
    )
  }
  fs.mkdirSync(path.join(root, 'node_modules'))
  if (native) {
    fs.writeFileSync(path.join(root, 'node_modules/.modules.yaml'), '')
  }
  const env = {
    ...cleanGitEnvironment(process.env),
    KLICKER_GIT_HOOK_RUNTIME: '',
    PATH: `${bin}:${process.env.PATH}`,
    HOOK_TEST_LOG: log,
  }
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'Hook Fixture')
  git('config', 'user.email', 'hook@example.invalid')
  writeFixtureFile(
    root,
    '.gitignore',
    'bin/\nnode_modules/\ntmp/\ncalls.jsonl\nidentity.*\nrefs.txt\n'
  )
  writeFixtureFile(
    root,
    '.prettierrc.mjs',
    options.prettierConfig ?? 'export default {}\n'
  )
  writeFixtureFile(
    root,
    '.prettierignore',
    'project/\nnode_modules/\nbin/\ntmp/\n'
  )
  writeFixtureFile(root, '.gitattributes', '* text=auto\n')
  writeFixtureFile(root, '.gitleaks.toml', '')
  writeFixtureFile(root, 'pnpm-lock.yaml', '')
  writeFixtureFile(
    root,
    'pnpm-workspace.yaml',
    'packages:\n  - apps/*\n  - packages/*\n'
  )
  copyFixtureFile(root, '.github/scripts/minimum-validation-class.cjs')
  copyFixtureFile(root, '.husky/pre-commit')
  copyFixtureFile(root, '.husky/pre-push')
  copyFixtureFile(root, 'util/check-removed-doc-artifacts.mjs')
  copyFixtureFile(root, 'util/run-git-hook.mjs')
  if (options.realIdentity) {
    copyFixtureFile(root, 'util/check-git-identity.sh')
  } else {
    writeFixtureFile(
      root,
      'util/check-git-identity.sh',
      [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        'cat > "$HOOK_IDENTITY_LOG"',
        'printf "%s\\n" "$@" > "$HOOK_IDENTITY_ARGS_LOG"',
        'exit "$HOOK_IDENTITY_EXIT"',
        '',
      ].join('\n')
    )
  }
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      scripts: {
        'check:all': 'run-p --npm-path pnpm check:format check',
        check: 'turbo run check',
      },
    })
  )
  fs.writeFileSync(
    path.join(root, '.lintstagedrc.mjs'),
    'export default { "*.{ts}": files => files.map(f => `biome format --no-errors-on-unmatched ${f}`) }'
  )
  git('add', '.')
  git('commit', '-q', '-m', 'fixture baseline')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
  const actualPrettierPath = fs.realpathSync(path.join(fixtureBin, 'prettier'))
  writeFixtureFile(
    root,
    'node_modules/prettier/package.json',
    '{"name":"prettier","main":"index.cjs"}\n'
  )
  writeFixtureFile(
    root,
    'node_modules/prettier/index.cjs',
    'module.exports = require(' + JSON.stringify(actualPrettierPath) + ')\n'
  )
  return {
    root,
    env,
    git,
    calls: () =>
      fs.existsSync(log)
        ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)
        : [],
  }
}

function stageFixtureFile(f, relativePath, source) {
  writeFixtureFile(f.root, relativePath, source)
  f.git('add', '--', relativePath)
}

function pushRecord(localRef, localSha, remoteSha) {
  return [localRef, localSha, localRef, remoteSha].join(' ')
}

function writeRefs(f, source) {
  const refsFile = path.join(f.root, 'refs.txt')
  fs.writeFileSync(refsFile, source)
  return refsFile
}

function runPrepPushEntrypoint(f, input, overrides = {}) {
  const identityLog = path.join(f.root, 'identity.stdin')
  const identityArgsLog = path.join(f.root, 'identity.args')
  const env = {
    ...f.env,
    TMPDIR: path.join(f.root, 'tmp'),
    HOOK_IDENTITY_LOG: identityLog,
    HOOK_IDENTITY_ARGS_LOG: identityArgsLog,
    HOOK_IDENTITY_EXIT: '0',
    ...overrides,
  }
  const result = spawnSync(
    'sh',
    [
      '-e',
      path.join(f.root, '.husky/pre-push'),
      'origin',
      'file:///synthetic/remote.git',
    ],
    {
      cwd: f.root,
      env,
      input,
      encoding: 'utf8',
    }
  )
  return {
    ...result,
    env,
    identityInput: fs.existsSync(identityLog)
      ? fs.readFileSync(identityLog, 'utf8')
      : null,
    identityArgs: fs.existsSync(identityArgsLog)
      ? fs.readFileSync(identityArgsLog, 'utf8')
      : null,
  }
}

function installInstrumentedPrettier(f) {
  const prettierRoot = path.join(f.root, 'node_modules/prettier')
  fs.rmSync(prettierRoot, { recursive: true, force: true })
  fs.mkdirSync(prettierRoot)
  writeFixtureFile(
    f.root,
    'node_modules/prettier/package.json',
    '{"name":"prettier","main":"index.cjs"}\n'
  )
  writeFixtureFile(
    f.root,
    'node_modules/prettier/index.cjs',
    [
      'module.exports = {',
      '  resolveConfigFile: async () => ' +
        JSON.stringify(path.join(f.root, '.prettierrc.mjs')) +
        ',',
      '  resolveConfig: async () => ({}),',
      '  getFileInfo: async () => ({ ignored: true }),',
      '  format: async () => {',
      '    throw new Error("PARSE_SENTINEL")',
      '  },',
      '  check: async () => true,',
      '}',
      '',
    ].join('\n')
  )
}

test('derives all checks and refuses unsupported syntax', () => {
  assert.deepEqual(checkTasks('run-p --npm-path pnpm check check:new'), [
    'check',
    'check:new',
  ])
  assert.throws(() => checkTasks('run-p check && true'))
})

test('Prisma checking waits for its output-producing build', () => {
  const root = new URL('../', import.meta.url)
  const manifest = JSON.parse(fs.readFileSync(new URL('package.json', root)))
  const turbo = JSON.parse(fs.readFileSync(new URL('turbo.json', root)))
  assert.ok(!manifest.scripts.check.split(' ').includes('--parallel'))
  assert.ok(
    turbo.tasks['@klicker-uzh/prisma#check'].dependsOn.includes('build')
  )
})

test('container build targets exact checkout and removes inherited Git state', async (t) => {
  const f = fixture(t)
  await runHook('build', f.root, {
    ...f.env,
    GIT_DIR: '/invalid',
    GIT_INDEX_FILE: '/invalid',
  })
  assert.deepEqual(f.calls(), [
    {
      command: 'devrouter',
      args: ['exec', f.root, '--', 'pnpm', 'run', 'build'],
      git: [],
    },
  ])
})

test('native build retains dependency validation through pnpm', async (t) => {
  const f = fixture(t, true)
  await runHook('build', f.root, {
    ...f.env,
    KLICKER_GIT_HOOK_RUNTIME: 'host',
  })
  assert.deepEqual(f.calls()[0].args, ['run', 'build'])
  assert.equal(f.calls()[0].command, 'pnpm')
})

test('default container routing survives a partial host tooling install', async (t) => {
  const f = fixture(t, true)
  await runHook('build', f.root, f.env)
  assert.equal(f.calls()[0].command, 'devrouter')
  await assert.rejects(
    runHook('build', f.root, { ...f.env, KLICKER_GIT_HOOK_RUNTIME: 'invalid' })
  )
})

test('host dependencies reject ancestor resolution and accept checkout-local installation', (t) => {
  const f = fixture(t)
  const child = path.join(f.root, 'checkout')
  fs.mkdirSync(child)
  fs.mkdirSync(path.join(child, 'node_modules'))
  fs.writeFileSync(path.join(child, 'package.json'), '{}')
  const ancestorPackage = path.join(f.root, 'node_modules/yaml')
  fs.mkdirSync(ancestorPackage, { recursive: true })
  fs.writeFileSync(
    path.join(ancestorPackage, 'package.json'),
    '{"name":"yaml"}'
  )
  assert.throws(() => assertHostDependencies(child), /checkout-local yaml/)
  const installed = fixture(t)
  const localPackage = path.join(installed.root, 'node_modules/yaml')
  fs.mkdirSync(localPackage, { recursive: true })
  fs.writeFileSync(path.join(localPackage, 'package.json'), '{"name":"yaml"}')
  assert.doesNotThrow(() => assertHostDependencies(installed.root))
})

test('Prettier resolution rejects an ancestor package', (t) => {
  const f = fixture(t)
  const checkout = path.join(f.root, 'nested/checkout')
  writeFixtureFile(checkout, 'package.json', '{}')

  assert.throws(() => loadPrettier(checkout), /checkout-local prettier/)
  assert.doesNotThrow(() => loadPrettier(f.root))
})

test('propagates failed check status', async (t) => {
  const f = fixture(t)
  await assert.rejects(
    runHook('build', f.root, { ...f.env, HOOK_TEST_EXIT: '7' }),
    { exitCode: 7 }
  )
})

test('formatting passes filenames literally without shell expansion', async (t) => {
  const f = fixture(t)
  const file = 'space $(touch unsafe).ts'
  fs.writeFileSync(path.join(f.root, file), 'const value = 1\n')
  f.git('add', '--', file)
  await runHook('check', f.root, f.env)
  assert.equal(f.calls()[0].args.at(-1), `./${file}`)
  assert.deepEqual(f.calls()[1].args, [
    'exec',
    f.root,
    '--',
    'pnpm',
    'run',
    'check',
  ])
  assert.equal(fs.existsSync(path.join(f.root, 'unsafe')), false)
})

test('partially staged files fail without changing index or worktree', async (t) => {
  const f = fixture(t)
  fs.writeFileSync(path.join(f.root, 'sample.ts'), 'const value = 1\n')
  f.git('add', 'sample.ts')
  fs.writeFileSync(path.join(f.root, 'sample.ts'), 'const value = 2\n')
  await assert.rejects(runHook('check', f.root, f.env), /Partially staged/)
  assert.equal(f.git('show', ':sample.ts'), 'const value = 1\n')
  assert.equal(
    fs.readFileSync(path.join(f.root, 'sample.ts'), 'utf8'),
    'const value = 2\n'
  )
  assert.deepEqual(f.calls(), [])
})

test('staged markdown validates exact index content without the runtime', async (t) => {
  const f = fixture(t)
  stageFixtureFile(f, 'docs/guide.md', '# Guide\n\n- item\n')

  await runHook('check', f.root, f.env)

  assert.deepEqual(f.calls(), [])
  assert.match(f.git('show', ':docs/guide.md'), /# Guide/)
})

test('staged markdown checks the index instead of a clean working copy', async (t) => {
  const f = fixture(t)
  stageFixtureFile(f, 'docs/diverged.md', '# Diverged\n\ntrailing  \n')
  writeFixtureFile(f.root, 'docs/diverged.md', '# Clean worktree\n')

  await assert.rejects(runHook('check', f.root, f.env), /trailing whitespace/)
  assert.deepEqual(f.calls(), [])
})

test('staged markdown preserves an alternate Git index', async (t) => {
  const f = fixture(t)
  const alternateIndex = path.join(f.root, '.git/alternate-index')
  const alternateEnv = { ...f.env, GIT_INDEX_FILE: alternateIndex }
  execFileSync('git', ['-C', f.root, 'read-tree', 'HEAD'], {
    env: alternateEnv,
  })
  writeFixtureFile(f.root, 'docs/alternate.md', '# Alternate index\n')
  execFileSync('git', ['-C', f.root, 'add', '--', 'docs/alternate.md'], {
    env: alternateEnv,
  })

  await runHook('check', f.root, alternateEnv)

  assert.deepEqual(f.calls(), [])
  assert.equal(f.git('diff', '--cached', '--name-only'), '')
})

test('markdown style enforcement applies outside repository ignores', async (t) => {
  const f = fixture(t)
  stageFixtureFile(f, 'docs/unformatted.md', '# Guide\n\n* item\n')

  await assert.rejects(runHook('check', f.root, f.env), /not formatted/)
  assert.deepEqual(f.calls(), [])
})

test('markdown style uses the committed repository Prettier config', async (t) => {
  const source = '# Title\n\n' + 'word '.repeat(20).trim() + '\n'
  const baseline = fixture(t)
  stageFixtureFile(baseline, 'docs/config.md', source)
  await runHook('check', baseline.root, baseline.env)
  assert.deepEqual(baseline.calls(), [])

  const configured = fixture(t, false, {
    prettierConfig: 'export default { proseWrap: "always", printWidth: 20 }\n',
  })
  stageFixtureFile(configured, 'docs/config.md', source)
  await assert.rejects(
    runHook('check', configured.root, configured.env),
    /not formatted/
  )
  assert.deepEqual(configured.calls(), [])
})

test('markdown validation rejects a non-root Prettier config', async (t) => {
  const f = fixture(t)
  commitFixtureFile(
    f,
    'docs/.prettierrc',
    '{}\n',
    'docs: add nested prettier config'
  )
  stageFixtureFile(f, 'docs/guide.md', '# Guide\n')

  await assert.rejects(
    runHook('check', f.root, f.env),
    /requires the repository Prettier config/
  )
  assert.deepEqual(f.calls(), [])
})

test('ignored markdown skips style policy after parser validation', async (t) => {
  const f = fixture(t)
  stageFixtureFile(f, 'project/unformatted.md', '# Plan\n\n* item\n')

  await runHook('check', f.root, f.env)

  assert.deepEqual(f.calls(), [])
})

test('ignored markdown still reaches the Prettier parser', async (t) => {
  const f = fixture(t)
  installInstrumentedPrettier(f)
  stageFixtureFile(f, 'project/parse.md', 'PARSE_SENTINEL\n')

  await assert.rejects(runHook('check', f.root, f.env), /PARSE_SENTINEL/)
  assert.deepEqual(f.calls(), [])
})

test('staged forbidden documentation is caught even after disk deletion', async (t) => {
  const f = fixture(t)
  stageFixtureFile(f, 'docs/index.md', '# Removed artifact\n')
  fs.unlinkSync(path.join(f.root, 'docs/index.md'))

  await assert.rejects(runHook('check', f.root, f.env), /must not be recreated/)
  assert.deepEqual(f.calls(), [])
})

test('a staged copy is detected and retains full validation', async (t) => {
  const f = fixture(t)
  commitFixtureFile(f, 'docs/source.md', '# Source\n', 'docs: add copy source')
  fs.copyFileSync(
    path.join(f.root, 'docs/source.md'),
    path.join(f.root, 'docs/copied.md')
  )
  f.git('add', '--', 'docs/copied.md')

  const records = parseNameStatusRecords(
    f.git(
      'diff',
      '--cached',
      '--name-status',
      '-z',
      '--find-renames',
      '-C',
      '--find-copies-harder'
    )
  )
  assert.deepEqual(records, [
    {
      status: 'C100',
      kind: 'C',
      paths: ['docs/source.md', 'docs/copied.md'],
    },
  ])

  await runHook('check', f.root, f.env)
  assert.equal(f.calls().length, 1)
})

test('unsafe staged modes and policy drift retain full validation', async (t) => {
  await t.test('executable markdown', async (t) => {
    const f = fixture(t)
    stageFixtureFile(f, 'docs/executable.md', '# Executable\n')
    fs.chmodSync(path.join(f.root, 'docs/executable.md'), 0o755)
    f.git('add', '--', 'docs/executable.md')
    await runHook('check', f.root, f.env)
    assert.equal(f.calls().length, 1)
  })

  await t.test('markdown symlink', async (t) => {
    const f = fixture(t)
    writeFixtureFile(f.root, 'docs/target.txt', 'target\n')
    fs.symlinkSync('target.txt', path.join(f.root, 'docs/link.md'))
    f.git('add', '--', 'docs/link.md')
    await runHook('check', f.root, f.env)
    assert.equal(f.calls().length, 1)
  })

  await t.test('mdx file', async (t) => {
    const f = fixture(t)
    stageFixtureFile(f, 'docs/component.mdx', '# Component\n')
    await runHook('check', f.root, f.env)
    assert.equal(f.calls().length, 1)
  })

  await t.test('dirty validation policy', async (t) => {
    const f = fixture(t)
    stageFixtureFile(f, 'docs/policy.md', '# Policy\n')
    writeFixtureFile(
      f.root,
      '.prettierrc.mjs',
      'export default { proseWrap: "always" }\n'
    )
    await runHook('check', f.root, f.env)
    assert.equal(f.calls().length, 1)
  })

  await t.test('attribute policy drift', async (t) => {
    const f = fixture(t)
    stageFixtureFile(f, 'docs/attributes.md', '# Attributes\n')
    writeFixtureFile(
      f.root,
      '.gitattributes',
      '* text=auto\n*.md text eol=lf\n'
    )
    await runHook('check', f.root, f.env)
    assert.equal(f.calls().length, 1)
  })

  await t.test('workspace policy drift', async (t) => {
    const f = fixture(t)
    stageFixtureFile(f, 'docs/workspace.md', '# Workspace\n')
    writeFixtureFile(
      f.root,
      'pnpm-workspace.yaml',
      'packages:\n  - apps/*\n  - packages/*\n  - extra/*\n'
    )
    await runHook('check', f.root, f.env)
    assert.equal(f.calls().length, 1)
  })
})

test('outgoing markdown validates every commit without the runtime', async (t) => {
  const f = fixture(t)
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  const newSha = commitFixtureFile(
    f,
    'docs/pushed.md',
    '# Pushed guide\n',
    'docs: add pushed guide'
  )
  const refsFile = writeRefs(
    f,
    pushRecord('refs/heads/docs/pushed-guide', newSha, oldSha)
  )

  await runHook('push', f.root, f.env, [refsFile, 'origin'])

  assert.deepEqual(f.calls(), [])
})

test('an outgoing copy is detected and retains full validation', async (t) => {
  const f = fixture(t)
  commitFixtureFile(
    f,
    'docs/copy-source.md',
    '# Copy source\n',
    'docs: add outgoing copy source'
  )
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  fs.copyFileSync(
    path.join(f.root, 'docs/copy-source.md'),
    path.join(f.root, 'docs/copy-destination.md')
  )
  f.git('add', '--', 'docs/copy-destination.md')
  f.git('commit', '-q', '-m', 'docs: copy outgoing source')
  const newSha = f.git('rev-parse', 'HEAD').trim()

  const records = parseNameStatusRecords(
    f.git(
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-z',
      '-r',
      '--find-renames',
      '-C',
      '--find-copies-harder',
      oldSha,
      newSha
    )
  )
  assert.deepEqual(records, [
    {
      status: 'C100',
      kind: 'C',
      paths: ['docs/copy-source.md', 'docs/copy-destination.md'],
    },
  ])

  const refsFile = writeRefs(
    f,
    pushRecord('refs/heads/docs/outgoing-copy', newSha, oldSha)
  )
  await runHook('push', f.root, f.env, [refsFile, 'origin'])

  assert.equal(f.calls().length, 1)
  assert.deepEqual(f.calls()[0].args.slice(-2), ['run', 'build'])
})

test('a reverted outgoing code change cannot hide behind a docs tail', async (t) => {
  const f = fixture(t)
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  commitFixtureFile(
    f,
    'apps/sample/src/value.ts',
    'export const value = 1\n',
    'feat: add transient value'
  )
  fs.unlinkSync(path.join(f.root, 'apps/sample/src/value.ts'))
  f.git('add', '-u')
  f.git('commit', '-q', '-m', 'revert transient value')
  const newSha = commitFixtureFile(
    f,
    'docs/tail.md',
    '# Documentation tail\n',
    'docs: add documentation tail'
  )
  const refsFile = writeRefs(
    f,
    pushRecord('refs/heads/docs/reverted-code-tail', newSha, oldSha)
  )

  await runHook('push', f.root, f.env, [refsFile, 'origin'])

  assert.equal(f.calls().length, 1)
  assert.deepEqual(f.calls()[0].args.slice(-2), ['run', 'build'])
})

test('a reverted policy change cannot narrow an outgoing docs tail', async (t) => {
  const f = fixture(t)
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  const originalConfig = f.git('show', 'HEAD:.prettierrc.mjs')
  commitFixtureFile(
    f,
    '.prettierrc.mjs',
    'export default { proseWrap: "always" }\n',
    'chore: change formatting policy'
  )
  commitFixtureFile(
    f,
    '.prettierrc.mjs',
    originalConfig,
    'chore: restore formatting policy'
  )
  const newSha = commitFixtureFile(
    f,
    'docs/policy-tail.md',
    '# Policy tail\n',
    'docs: add policy tail'
  )
  const refsFile = writeRefs(
    f,
    pushRecord('refs/heads/docs/policy-revert', newSha, oldSha)
  )

  await runHook('push', f.root, f.env, [refsFile, 'origin'])

  assert.equal(f.calls().length, 1)
  assert.deepEqual(f.calls()[0].args.slice(-2), ['run', 'build'])
})

test('outgoing integration detection uses the remote default and fails closed', async (t) => {
  await t.test('custom remote default', async (t) => {
    const f = fixture(t)
    f.git('update-ref', 'refs/remotes/origin/integration', 'HEAD')
    f.git(
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
      'refs/remotes/origin/integration'
    )
    const oldSha = f.git('rev-parse', 'HEAD').trim()
    const newSha = commitFixtureFile(
      f,
      'docs/default.md',
      '# Default branch docs\n',
      'docs: add default branch docs'
    )
    const refsFile = writeRefs(
      f,
      pushRecord('refs/heads/integration', newSha, oldSha)
    )

    await runHook('push', f.root, f.env, [refsFile, 'origin'])

    assert.equal(f.calls().length, 1)
  })

  await t.test('missing remote default', async (t) => {
    const f = fixture(t)
    f.git('symbolic-ref', '--delete', 'refs/remotes/origin/HEAD')
    const oldSha = f.git('rev-parse', 'HEAD').trim()
    const newSha = commitFixtureFile(
      f,
      'docs/unknown-default.md',
      '# Unknown default docs\n',
      'docs: add unknown default docs'
    )
    const refsFile = writeRefs(
      f,
      pushRecord('refs/heads/docs/unknown-default', newSha, oldSha)
    )

    await runHook('push', f.root, f.env, [refsFile, 'origin'])

    assert.equal(f.calls().length, 1)
  })

  await t.test('version integration branch', async (t) => {
    const f = fixture(t)
    const oldSha = f.git('rev-parse', 'HEAD').trim()
    const newSha = commitFixtureFile(
      f,
      'docs/version.md',
      '# Version branch docs\n',
      'docs: add version branch docs'
    )
    const refsFile = writeRefs(
      f,
      pushRecord('refs/heads/v3-feature', newSha, oldSha)
    )

    await runHook('push', f.root, f.env, [refsFile, 'origin'])

    assert.equal(f.calls().length, 1)
  })
})

test('outgoing merge history retains full validation', async (t) => {
  const f = fixture(t)
  const baseBranch = f.git('branch', '--show-current').trim()
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  f.git('branch', 'side-docs')
  f.git('checkout', '-q', 'side-docs')
  commitFixtureFile(
    f,
    'docs/side.md',
    '# Side documentation\n',
    'docs: add side documentation'
  )
  f.git('checkout', '-q', baseBranch)
  commitFixtureFile(
    f,
    'docs/base.md',
    '# Base documentation\n',
    'docs: add base documentation'
  )
  f.git('merge', '-q', '--no-ff', '-m', 'merge side docs', 'side-docs')
  const newSha = f.git('rev-parse', 'HEAD').trim()
  const refsFile = writeRefs(
    f,
    pushRecord('refs/heads/docs/merged', newSha, oldSha)
  )

  await runHook('push', f.root, f.env, [refsFile, 'origin'])

  assert.equal(f.calls().length, 1)
})

test('outgoing forbidden documentation is caught from the exact tree', async (t) => {
  const f = fixture(t)
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  const newSha = commitFixtureFile(
    f,
    'docs/index.md',
    '# Removed outgoing artifact\n',
    'docs: recreate removed artifact'
  )
  fs.unlinkSync(path.join(f.root, 'docs/index.md'))
  const refsFile = writeRefs(
    f,
    pushRecord('refs/heads/docs/forbidden', newSha, oldSha)
  )

  await assert.rejects(
    runHook('push', f.root, f.env, [refsFile, 'origin']),
    /must not be recreated/
  )
  assert.deepEqual(f.calls(), [])
})

test('unsupported outgoing refs retain the existing full build', async (t) => {
  const f = fixture(t)
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  const newSha = commitFixtureFile(
    f,
    'docs/refs.md',
    '# Ref checks\n',
    'docs: add ref checks'
  )
  const inputs = [
    pushRecord('refs/heads/docs/new-ref', newSha, '0'.repeat(40)),
    pushRecord('refs/heads/docs/deleted', '0'.repeat(40), oldSha),
    pushRecord('refs/tags/v9.9.9', newSha, oldSha),
    pushRecord('refs/heads/v3-ai', newSha, oldSha),
    pushRecord('refs/heads/docs/multiple', newSha, oldSha) +
      '\n' +
      pushRecord('refs/heads/docs/other', newSha, oldSha) +
      '\n',
    'malformed input\n',
    pushRecord('refs/heads/docs/extra-newline', newSha, oldSha) + '\n\n',
  ]
  let initialCalls = 0
  for (const input of inputs) {
    const refsFile = writeRefs(f, input)
    await runHook('push', f.root, f.env, [refsFile, 'origin'])
    const calls = f.calls()
    assert.equal(calls.length, initialCalls + 1)
    assert.deepEqual(calls.at(-1).args.slice(-2), ['run', 'build'])
    initialCalls = calls.length
  }
})

test('real pre-push entrypoint replays one stdin capture through both consumers', async (t) => {
  const f = fixture(t)
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  const newSha = commitFixtureFile(
    f,
    'docs/entrypoint.md',
    '# Entrypoint guide\n',
    'docs: add entrypoint guide'
  )
  const input = pushRecord('refs/heads/docs/entrypoint', newSha, oldSha) + '\n'

  const result = runPrepPushEntrypoint(f, input)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.identityInput, input)
  assert.equal(
    result.identityArgs,
    'pre-push\norigin\nfile:///synthetic/remote.git\n'
  )
  assert.deepEqual(f.calls(), [])
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'tmp')), [])
})

test('real pre-push entrypoint replays multiple refs to full validation', async (t) => {
  const f = fixture(t)
  const head = f.git('rev-parse', 'HEAD').trim()
  const input = [
    pushRecord('refs/heads/docs/first', head, head),
    pushRecord('refs/heads/docs/second', head, head),
    '',
  ].join('\n')

  const result = runPrepPushEntrypoint(f, input)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.identityInput, input)
  assert.equal(f.calls().length, 1)
  assert.deepEqual(f.calls()[0].args.slice(-2), ['run', 'build'])
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'tmp')), [])
})

test('real pre-push identity guard rejects outgoing fixture commits', async (t) => {
  const f = fixture(t, false, { realIdentity: true })
  const oldSha = f.git('rev-parse', 'HEAD').trim()
  writeFixtureFile(f.root, 'docs/identity-real.md', '# Identity check\n')
  f.git('add', '--', 'docs/identity-real.md')
  f.git(
    '-c',
    'user.name=CI fixture',
    '-c',
    'user.email=ci@example.invalid',
    'commit',
    '-q',
    '-m',
    'docs: commit with fixture identity'
  )
  const newSha = f.git('rev-parse', 'HEAD').trim()
  const input =
    pushRecord('refs/heads/docs/identity-real', newSha, oldSha) + '\n'

  const result = runPrepPushEntrypoint(f, input)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /outgoing commits use the fixture identity/)
  assert.deepEqual(f.calls(), [])
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'tmp')), [])
})

test('identity failure preserves status, arguments and stop-before-dispatch', async (t) => {
  const f = fixture(t)
  const head = f.git('rev-parse', 'HEAD').trim()
  const input = pushRecord('refs/heads/docs/identity', head, head) + '\n'

  const result = runPrepPushEntrypoint(f, input, {
    HOOK_IDENTITY_EXIT: '23',
  })

  assert.equal(result.status, 23)
  assert.equal(result.identityInput, input)
  assert.equal(
    result.identityArgs,
    'pre-push\norigin\nfile:///synthetic/remote.git\n'
  )
  assert.deepEqual(f.calls(), [])
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'tmp')), [])
})

test('dispatcher failure preserves status after stdin replay', async (t) => {
  const f = fixture(t)
  const head = f.git('rev-parse', 'HEAD').trim()
  const input = pushRecord('refs/heads/docs/dispatcher', head, head) + '\n'

  const result = runPrepPushEntrypoint(f, input, {
    HOOK_TEST_EXIT: '7',
  })

  assert.equal(result.status, 7)
  assert.equal(result.identityInput, input)
  assert.equal(f.calls().length, 1)
  assert.deepEqual(f.calls()[0].args.slice(-2), ['run', 'build'])
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'tmp')), [])
})
