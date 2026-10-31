import { spawnSync } from 'node:child_process'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkRemovedDocArtifacts } from './check-removed-doc-artifacts.mjs'

const requireFromHere = createRequire(import.meta.url)
const { isLocalHookDocumentationPath, parseNameStatusRecords } =
  requireFromHere('../.github/scripts/minimum-validation-class.cjs')

const ZERO_SHA = '0'.repeat(40)
const PRETTIER_CONFIG_PATH = '.prettierrc.mjs'
const VALIDATION_POLICY_PATHS = Object.freeze([
  '.github/scripts/minimum-validation-class.cjs',
  '.gitattributes',
  '.gitleaks.toml',
  '.husky/pre-commit',
  '.husky/pre-push',
  '.lintstagedrc.mjs',
  '.prettierignore',
  PRETTIER_CONFIG_PATH,
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'util/check-git-identity.sh',
  'util/check-removed-doc-artifacts.mjs',
  'util/run-git-hook.mjs',
])

export function cleanGitEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !key.startsWith('GIT_'))
  )
}

function gitEnvironment(environment) {
  const env = cleanGitEnvironment(environment)
  if (environment.GIT_INDEX_FILE) {
    env.GIT_INDEX_FILE = environment.GIT_INDEX_FILE
  }
  return env
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join('\n')
    const error = new Error(
      command +
        ' failed (' +
        (result.status ?? result.signal) +
        ')' +
        (detail ? '\n' + detail : '')
    )
    error.exitCode = result.status ?? 1
    throw error
  }
  return result.stdout
}

function git(root, environment, args) {
  return run('git', args, {
    cwd: root,
    env: gitEnvironment(environment),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function checkTasks(script) {
  const prefix = 'run-p --npm-path pnpm '
  if (!script?.startsWith(prefix))
    throw new Error('Unsupported check:all command')
  const tasks = script.slice(prefix.length).trim().split(/\s+/)
  if (!tasks.every((task) => /^[\w:-]+$/.test(task))) {
    throw new Error('Unsupported check:all task syntax')
  }
  return tasks
}

export function assertHostDependencies(root) {
  const require = createRequire(path.join(root, 'package.json'))
  const modules = path.join(root, 'node_modules')
  try {
    const resolved = realpathSync(require.resolve('yaml/package.json'))
    const relative = path.relative(realpathSync(modules), resolved)
    if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new Error('Dependency resolved outside this checkout')
  } catch {
    throw new Error(
      'Host checks require checkout-local yaml. Install root tooling with pnpm --filter @klicker-uzh/monorepo install --frozen-lockfile --ignore-scripts. For container-backed application checks, set KLICKER_GIT_HOOK_RUNTIME=container.'
    )
  }
}

function splitZ(value) {
  const fields = value.split('\0')
  if (fields.at(-1) === '') fields.pop()
  return fields
}

function parseIndexEntries(value) {
  return splitZ(value).map((field) => {
    const tab = field.indexOf('\t')
    if (tab === -1) throw new Error('Malformed Git index entry')
    const metadata = field.slice(0, tab).split(' ')
    if (metadata.length !== 3) throw new Error('Malformed Git index entry')
    return {
      mode: metadata[0],
      object: metadata[1],
      stage: metadata[2],
      path: field.slice(tab + 1),
    }
  })
}

function parseTreeEntries(value) {
  return splitZ(value).map((field) => {
    const tab = field.indexOf('\t')
    if (tab === -1) throw new Error('Malformed Git tree entry')
    const metadata = field.slice(0, tab).split(' ')
    if (metadata.length !== 3) throw new Error('Malformed Git tree entry')
    return {
      mode: metadata[0],
      type: metadata[1],
      object: metadata[2],
      path: field.slice(tab + 1),
    }
  })
}

function onlyLocalDocumentation(records) {
  return (
    records.length > 0 &&
    records.every(
      (record) =>
        (record.kind === 'A' || record.kind === 'M') &&
        record.paths.length === 1 &&
        isLocalHookDocumentationPath(record.paths[0])
    )
  )
}

function assertRegularBlob(entry, changedPath) {
  if (
    entry.mode !== '100644' ||
    (entry.type && entry.type !== 'blob') ||
    (entry.stage && entry.stage !== '0')
  ) {
    throw new Error(
      'Documentation hook requires a regular non-executable file: ' +
        changedPath
    )
  }
}

function indexEntry(root, environment, changedPath) {
  const entries = parseIndexEntries(
    git(root, environment, ['ls-files', '--stage', '-z', '--', changedPath])
  )
  if (entries.length !== 1 || entries[0].path !== changedPath) return null
  return entries[0]
}

function treeEntry(root, environment, revision, changedPath) {
  const entries = parseTreeEntries(
    git(root, environment, ['ls-tree', '-z', revision, '--', changedPath])
  )
  if (entries.length !== 1 || entries[0].path !== changedPath) return null
  return entries[0]
}

function policyEntry(root, environment, source, policyPath) {
  if (source === 'index') {
    return indexEntry(root, environment, policyPath)
  }
  if (source === 'worktree') {
    const absolute = path.join(root, policyPath)
    let stats
    try {
      stats = lstatSync(absolute)
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
    if (!stats.isFile()) return null
    return {
      mode: stats.mode & 0o111 ? '100755' : '100644',
      type: 'blob',
      stage: '0',
      object: git(root, environment, [
        'hash-object',
        '--no-filters',
        '--',
        policyPath,
      ]).trim(),
      path: policyPath,
    }
  }
  return treeEntry(root, environment, source, policyPath)
}

function policyClosureEquivalent(root, environment, sources) {
  for (const policyPath of VALIDATION_POLICY_PATHS) {
    const entries = sources.map((source) =>
      policyEntry(root, environment, source, policyPath)
    )
    if (entries.every((entry) => entry === null)) continue
    if (entries.some((entry) => entry === null)) return false
    const expected = entries[0]
    if (
      entries.some(
        (entry) =>
          entry.mode !== expected.mode || entry.object !== expected.object
      )
    ) {
      return false
    }
  }
  return true
}

function whitespaceCheck(root, environment, args) {
  git(root, environment, ['diff', '--check', '--no-renames', ...args])
}

export function loadPrettier(root) {
  const require = createRequire(path.join(root, 'package.json'))
  try {
    const checkout = realpathSync(root)
    const resolved = realpathSync(require.resolve('prettier'))
    const relative = path.relative(checkout, resolved)
    if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new Error('Dependency resolved outside this checkout')
    }
    return require('prettier')
  } catch {
    throw new Error(
      'Documentation checks require checkout-local prettier. Install root tooling with pnpm --filter @klicker-uzh/monorepo install --frozen-lockfile --ignore-scripts.'
    )
  }
}

async function validateMarkdown(root, versions) {
  const prettier = loadPrettier(root)
  const ignorePath = path.join(root, '.prettierignore')
  const configPath = path.join(root, PRETTIER_CONFIG_PATH)
  for (const version of versions) {
    const absolute = path.join(root, version.path)
    const resolvedConfigPath = await prettier.resolveConfigFile(absolute)
    if (
      !resolvedConfigPath ||
      realpathSync(resolvedConfigPath) !== realpathSync(configPath)
    ) {
      throw new Error(
        'Markdown validation requires the repository Prettier config: ' +
          PRETTIER_CONFIG_PATH
      )
    }
    const config = await prettier.resolveConfig(absolute, {
      config: configPath,
      editorconfig: false,
      useCache: false,
    })
    if (!config) {
      throw new Error(
        'Markdown validation could not resolve the repository Prettier config.'
      )
    }
    const formatOptions = {
      ...config,
      filepath: absolute,
      parser: 'markdown',
    }
    const fileInfo = await prettier.getFileInfo(absolute, { ignorePath })
    await prettier.format(version.source, formatOptions)
    if (fileInfo.ignored) {
      console.log(
        'Markdown style skipped by repository ignore policy: ' + version.label
      )
      continue
    }
    if (!(await prettier.check(version.source, formatOptions))) {
      throw new Error(
        'Markdown is not formatted according to repository policy: ' +
          version.label
      )
    }
  }
}

function indexInventory(root, environment) {
  return splitZ(git(root, environment, ['ls-files', '-z']))
}

function treeInventory(root, environment, revision) {
  return splitZ(
    git(root, environment, ['ls-tree', '-r', '-z', '--name-only', revision])
  )
}

function exactIndexDocVersions(root, environment, records) {
  return records.map((record) => {
    const entry = indexEntry(root, environment, record.paths[0])
    if (!entry) throw new Error('Missing staged Git object')
    assertRegularBlob(entry, record.paths[0])
    if (record.kind === 'M') {
      const previous = treeEntry(root, environment, 'HEAD', record.paths[0])
      if (!previous) throw new Error('Missing previous Git object')
      assertRegularBlob(previous, record.paths[0])
    }
    return {
      path: record.paths[0],
      label: 'index:' + record.paths[0],
      source: git(root, environment, ['cat-file', 'blob', entry.object]),
    }
  })
}

async function tryStagedDocumentation(root, environment) {
  let records
  try {
    records = parseNameStatusRecords(
      git(root, environment, [
        'diff',
        '--cached',
        '--name-status',
        '-z',
        '--find-renames',
        '-C',
        '--find-copies-harder',
      ])
    )
  } catch {
    return false
  }
  if (!onlyLocalDocumentation(records)) return false
  if (
    !policyClosureEquivalent(root, environment, ['HEAD', 'index', 'worktree'])
  ) {
    return false
  }

  let versions
  try {
    versions = exactIndexDocVersions(root, environment, records)
  } catch {
    return false
  }
  whitespaceCheck(root, environment, ['--cached'])
  await validateMarkdown(root, versions)
  checkRemovedDocArtifacts({
    root,
    inventories: [{ label: 'index', paths: indexInventory(root, environment) }],
  })
  console.log('Documentation-only staged validation passed.')
  return true
}

function parsePushInput(input) {
  const lines = (input.endsWith('\n') ? input.slice(0, -1) : input).split('\n')
  if (lines.length !== 1 || lines[0] === '') return null
  const fields = lines[0].split(' ')
  if (fields.length !== 4 || fields.some((field) => field === '')) return null
  const [localRef, localSha, remoteRef, remoteSha] = fields
  if (
    localRef !== remoteRef ||
    !/^refs\/heads\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(localRef) ||
    !/^[0-9a-f]{40}$/.test(localSha) ||
    !/^[0-9a-f]{40}$/.test(remoteSha)
  ) {
    return null
  }
  return { localRef, localSha, remoteRef, remoteSha }
}

function resolveDefaultBranch(root, environment, remoteName) {
  if (typeof remoteName !== 'string' || !/^[A-Za-z0-9._-]+$/.test(remoteName)) {
    return null
  }
  try {
    const remoteHeadRef = 'refs/remotes/' + remoteName + '/HEAD'
    const target = git(root, environment, [
      'symbolic-ref',
      '--quiet',
      '--short',
      remoteHeadRef,
    ]).trim()
    const prefix = remoteName + '/'
    if (!target.startsWith(prefix)) return null
    const branch = target.slice(prefix.length)
    if (!branch) return null
    git(root, environment, ['rev-parse', '--verify', target + '^{commit}'])
    return branch
  } catch {
    return null
  }
}

function isIntegrationBranch(localRef, defaultBranch) {
  const branch = localRef.slice('refs/heads/'.length)
  if (
    branch === defaultBranch ||
    branch === 'main' ||
    branch === 'master' ||
    branch === 'v3' ||
    branch.startsWith('v3')
  ) {
    return true
  }
  return /^(deploy|release|stg|stage|prd|prod|production)(?:$|[-/])/.test(
    branch
  )
}

function verifyObject(root, environment, object, type) {
  try {
    git(root, environment, ['cat-file', '-e', object + '^' + '{' + type + '}'])
    return true
  } catch {
    return false
  }
}

function outgoingCommits(root, environment, oldSha, localSha) {
  if (
    !verifyObject(root, environment, oldSha, 'commit') ||
    !verifyObject(root, environment, localSha, 'commit')
  ) {
    return null
  }
  try {
    git(root, environment, ['merge-base', '--is-ancestor', oldSha, localSha])
  } catch {
    return null
  }
  const commits = splitZ(
    git(root, environment, [
      'rev-list',
      '--reverse',
      '-z',
      oldSha + '..' + localSha,
    ])
  ).filter(Boolean)
  if (commits.length === 0) return null

  const transitions = []
  let parent = oldSha
  for (const commit of commits) {
    const object = git(root, environment, ['cat-file', '-p', commit])
    const parents = object
      .split('\n')
      .filter((line) => line.startsWith('parent '))
      .map((line) => line.slice('parent '.length))
    if (parents.length !== 1 || parents[0] !== parent) return null
    if (!verifyObject(root, environment, parent, 'commit')) return null
    transitions.push({ parent, commit })
    parent = commit
  }
  return transitions
}

function outgoingDocVersions(root, environment, transitions) {
  const versions = []
  for (const transition of transitions) {
    let records
    try {
      records = parseNameStatusRecords(
        git(root, environment, [
          'diff-tree',
          '--no-commit-id',
          '--name-status',
          '-z',
          '-r',
          '--find-renames',
          '-C',
          '--find-copies-harder',
          transition.parent,
          transition.commit,
        ])
      )
    } catch {
      return null
    }
    if (!onlyLocalDocumentation(records)) return null
    for (const record of records) {
      const entry = treeEntry(
        root,
        environment,
        transition.commit,
        record.paths[0]
      )
      if (!entry) return null
      try {
        assertRegularBlob(entry, record.paths[0])
        if (record.kind === 'M') {
          const previous = treeEntry(
            root,
            environment,
            transition.parent,
            record.paths[0]
          )
          if (!previous) return null
          assertRegularBlob(previous, record.paths[0])
        }
      } catch {
        return null
      }
      versions.push({
        path: record.paths[0],
        label: transition.commit + ':' + record.paths[0],
        source: git(root, environment, ['cat-file', 'blob', entry.object]),
      })
    }
  }
  return versions
}

async function tryOutgoingDocumentation(
  root,
  environment,
  refsFile,
  remoteName
) {
  if (!refsFile) return false
  let input
  try {
    input = readFileSync(refsFile, 'utf8')
  } catch {
    return false
  }
  const push = parsePushInput(input)
  const defaultBranch = resolveDefaultBranch(root, environment, remoteName)
  if (
    !push ||
    !defaultBranch ||
    push.remoteSha === ZERO_SHA ||
    push.localSha === ZERO_SHA ||
    push.localSha === push.remoteSha ||
    isIntegrationBranch(push.localRef, defaultBranch) ||
    git(root, environment, [
      'rev-parse',
      '--verify',
      'HEAD^{commit}',
    ]).trim() !== push.localSha
  ) {
    return false
  }

  const transitions = outgoingCommits(
    root,
    environment,
    push.remoteSha,
    push.localSha
  )
  if (!transitions) return false
  if (
    !policyClosureEquivalent(root, environment, [
      push.remoteSha,
      push.localSha,
      'HEAD',
      'worktree',
    ])
  ) {
    return false
  }
  const versions = outgoingDocVersions(root, environment, transitions)
  if (!versions) return false

  const inventories = []
  for (const transition of transitions) {
    whitespaceCheck(root, environment, [transition.parent, transition.commit])
    inventories.push({
      label: transition.commit,
      paths: treeInventory(root, environment, transition.commit),
    })
  }
  await validateMarkdown(root, versions)
  checkRemovedDocArtifacts({ root, inventories })
  console.log('Documentation-only outgoing validation passed.')
  return true
}

function runContainerCommand(root, environment, native, args) {
  const options = { cwd: root, env: cleanGitEnvironment(environment) }
  if (native) {
    run('pnpm', args, options)
    return
  }
  run('devrouter', ['exec', root, '--', 'pnpm', ...args], options)
}

async function runCheck(root, environment, native) {
  const options = { cwd: root, env: cleanGitEnvironment(environment) }
  const container = (args) =>
    runContainerCommand(root, environment, native, args)
  const { scripts } = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8')
  )
  if (
    checkTasks(scripts['check:all']).some((task) =>
      /^(node|bash) [\w./* -]+$/.test(scripts[task] ?? '')
    )
  )
    assertHostDependencies(root)
  for (const task of checkTasks(scripts['check:all'])) {
    if (task === 'check:format') {
      if (native) {
        run('pnpm', ['run', task], {
          cwd: root,
          env: environment,
        })
        continue
      }
      // Git stays on the host, including an alternate index supplied by Git.
      const git = (...args) =>
        run('git', args, {
          cwd: root,
          env: environment,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'inherit'],
        })
      const files = git(
        'diff',
        '--cached',
        '--name-only',
        '-z',
        '--diff-filter=ACMRT'
      )
        .split('\0')
        .filter(Boolean)
      const unstaged = new Set(git('diff', '--name-only', '-z').split('\0'))
      const { default: rules } = await import(
        pathToFileURL(path.join(root, '.lintstagedrc.mjs'))
      )
      for (const file of files) {
        const extension = path.extname(file).slice(1)
        const rule = Object.entries(rules).find(([pattern]) => {
          const match = /^\*\.\{([\w,]+)\}$/.exec(pattern)
          if (!match)
            throw new Error(`Unsupported staged format pattern: ${pattern}`)
          return match[1].split(',').includes(extension)
        })
        if (!rule) continue
        if (unstaged.has(file))
          throw new Error(
            `Partially staged file: ${file}. Fully stage or unstage it before container-backed formatting.`
          )
        const absolute = path.join(root, file)
        for (const command of rule[1]([absolute])) {
          if (!command.endsWith(` ${absolute}`))
            throw new Error('Unsupported staged formatter command')
          const prefix = command.slice(0, -absolute.length - 1).split(' ')
          if (!prefix.every((arg) => /^[\w./=-]+$/.test(arg)))
            throw new Error('Unsupported staged formatter arguments')
          container(['exec', ...prefix, `./${file}`])
        }
      }
    } else if (/^(node|bash) [\w./* -]+$/.test(scripts[task] ?? '')) {
      // Host contract tests may create Git fixtures or invoke host devrouter.
      run('sh', ['-c', scripts[task]], options)
    } else {
      if (!scripts[task]) throw new Error(`Missing check script: ${task}`)
      container(['run', task])
    }
  }
}

export async function runHook(
  mode,
  root,
  environment = process.env,
  hookArgs = []
) {
  if (!['check', 'build', 'push'].includes(mode))
    throw new Error('Expected check, build or push')
  const runtime = environment.KLICKER_GIT_HOOK_RUNTIME
  if (runtime && !['host', 'container'].includes(runtime))
    throw new Error('KLICKER_GIT_HOOK_RUNTIME must be host or container')
  const native = runtime === 'host'

  if (
    mode === 'push' &&
    (await tryOutgoingDocumentation(
      root,
      environment,
      hookArgs[0],
      hookArgs[1]
    ))
  ) {
    return
  }
  if (mode === 'check' && (await tryStagedDocumentation(root, environment))) {
    return
  }
  if (mode === 'build' || mode === 'push') {
    runContainerCommand(root, environment, native, ['run', 'build'])
    return
  }
  await runCheck(root, environment, native)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  try {
    await runHook(process.argv[2], root, process.env, process.argv.slice(3))
  } catch (error) {
    console.error(error.message)
    process.exitCode = error.exitCode ?? 1
  }
}
