#!/usr/bin/env node
import type { BranchStrategy } from '@ai-hero/sandcastle'
import { resolve } from 'node:path'

const DEFAULT_MODEL = 'openrouter/anthropic/claude-opus-4'
const DEFAULT_KLICKER_NETWORK = 'klicker-uzh_klicker'

interface CliOptions {
  promptFile?: string
  task?: string
  issueNumber?: string
  model: string
  branchStrategy?: BranchStrategy
  baseBranch?: string
  maxIterations?: number
  attachKlickerNetwork: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    model: process.env.SANDCASTLE_MODEL ?? DEFAULT_MODEL,
    attachKlickerNetwork: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--prompt' || a === '-p')
      opts.promptFile = readOptionValue(argv, ++i, a)
    else if (a === '--task' || a === '-t')
      opts.task = readOptionValue(argv, ++i, a)
    else if (a === '--issue') opts.issueNumber = readOptionValue(argv, ++i, a)
    else if (a === '--model' || a === '-m')
      opts.model = readOptionValue(argv, ++i, a)
    else if (a === '--base-branch')
      opts.baseBranch = readOptionValue(argv, ++i, a)
    else if (a === '--max-iterations') {
      const value = Number(readOptionValue(argv, ++i, a))
      if (!Number.isInteger(value) || value < 1) {
        console.error('--max-iterations must be a positive integer')
        process.exit(1)
      }
      opts.maxIterations = value
    } else if (a === '--branch')
      opts.branchStrategy = {
        type: 'branch',
        branch: readOptionValue(argv, ++i, a),
      }
    else if (a === '--head') opts.branchStrategy = { type: 'head' }
    else if (a === '--with-services') opts.attachKlickerNetwork = true
    else if (!opts.promptFile && !a.startsWith('-')) opts.promptFile = a
  }
  return opts
}

function readOptionValue(
  argv: string[],
  index: number,
  option: string
): string {
  const value = argv[index]
  if (!value || value.startsWith('-')) {
    console.error(`${option} requires a value`)
    process.exit(1)
  }
  return value
}

function normalizeIssueNumber(issueNumber: string): string {
  if (!/^\d+$/.test(issueNumber)) {
    console.error('--issue must be a GitHub issue number')
    process.exit(1)
  }
  return issueNumber
}

function getBranchStrategy(opts: CliOptions): BranchStrategy {
  if (opts.branchStrategy?.type === 'branch') {
    return opts.baseBranch
      ? { ...opts.branchStrategy, baseBranch: opts.baseBranch }
      : opts.branchStrategy
  }

  if (opts.branchStrategy) return opts.branchStrategy

  if (opts.issueNumber) {
    const issueNumber = normalizeIssueNumber(opts.issueNumber)
    return opts.baseBranch
      ? {
          type: 'branch',
          branch: `sandcastle/issue-${issueNumber}`,
          baseBranch: opts.baseBranch,
        }
      : { type: 'branch', branch: `sandcastle/issue-${issueNumber}` }
  }

  return { type: 'merge-to-head' }
}

async function main() {
  const [{ opencode, run }, { docker }] = await Promise.all([
    import('@ai-hero/sandcastle'),
    import('@ai-hero/sandcastle/sandboxes/docker'),
  ])

  const opts = parseArgs(process.argv.slice(2))
  const issueNumber = opts.issueNumber
    ? normalizeIssueNumber(opts.issueNumber)
    : undefined

  const promptFile = opts.promptFile
    ? resolve(process.cwd(), opts.promptFile)
    : resolve(
        process.cwd(),
        issueNumber ? '.sandcastle/issue-prompt.md' : '.sandcastle/prompt.md'
      )

  const task =
    opts.task ??
    process.env.SANDCASTLE_TASK ??
    'List the top-level directories of the repo and report Node + pnpm versions.'

  const forwardedEnv: Record<string, string> = {}

  if (process.env.OPENROUTER_API_KEY) {
    forwardedEnv.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  }

  if (issueNumber) {
    const ghToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
    if (ghToken) forwardedEnv.GH_TOKEN = ghToken
  }

  if (opts.attachKlickerNetwork) {
    for (const key of [
      'DATABASE_URL',
      'REDIS_HOST',
      'REDIS_PORT',
      'REDIS_CACHE_HOST',
      'REDIS_CACHE_PORT',
      'HATCHET_CLIENT_TOKEN',
      'OPENAI_API_KEY',
      'OPENAI_BASE_URL',
    ]) {
      const v = process.env[key]
      if (v) forwardedEnv[key] = v
    }
  }

  const sandbox = docker({
    imageName: 'klicker-sandcastle:local',
    mounts: [
      {
        hostPath: process.env.PNPM_STORE_PATH ?? '~/.local/share/pnpm',
        sandboxPath: '/home/agent/.local/share/pnpm',
        readonly: false,
      },
    ],
    env: forwardedEnv,
    network: opts.attachKlickerNetwork
      ? (process.env.SANDCASTLE_DOCKER_NETWORK ?? DEFAULT_KLICKER_NETWORK)
      : undefined,
  })

  const agent = opencode(opts.model)

  await run({
    agent,
    sandbox,
    promptFile,
    promptArgs: issueNumber
      ? {
          ISSUE_NUMBER: issueNumber,
          VIEW_TASK_COMMAND: `gh issue view ${issueNumber} --json number,title,body,labels,comments,url`,
        }
      : { TASK: task },
    maxIterations: opts.maxIterations,
    branchStrategy: getBranchStrategy(opts),
    hooks: {
      sandbox: {
        onSandboxReady: [
          { command: 'pnpm install --frozen-lockfile', timeoutMs: 15 * 60_000 },
          {
            command: 'pnpm --filter @klicker-uzh/prisma generate',
            timeoutMs: 5 * 60_000,
          },
        ],
      },
    },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
