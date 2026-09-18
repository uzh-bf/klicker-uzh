import { spawnSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function cleanGitEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !key.startsWith('GIT_'))
  )
}

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const error = new Error(
      `${command} failed (${result.status ?? result.signal})`
    )
    error.exitCode = result.status ?? 1
    throw error
  }
  return result.stdout
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

export async function runHook(mode, root, environment = process.env) {
  if (!['check', 'build'].includes(mode))
    throw new Error('Expected check or build')
  const env = cleanGitEnvironment(environment)
  const options = { cwd: root, env }
  const runtime = environment.KLICKER_GIT_HOOK_RUNTIME
  if (runtime && !['host', 'container'].includes(runtime))
    throw new Error('KLICKER_GIT_HOOK_RUNTIME must be host or container')
  const native = runtime === 'host'
  const container = (args) =>
    native
      ? run('pnpm', args, options)
      : run('devrouter', ['exec', root, '--', 'pnpm', ...args], options)
  if (mode === 'build') {
    container(['run', 'build'])
    return
  }

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
        run('pnpm', ['run', task], { cwd: root, env: environment })
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

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  try {
    await runHook(process.argv[2], root)
  } catch (error) {
    console.error(error.message)
    process.exitCode = error.exitCode ?? 1
  }
}
