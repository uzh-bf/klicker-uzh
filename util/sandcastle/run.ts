#!/usr/bin/env node
import { opencode, run, type BranchStrategy } from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { resolve } from 'node:path'

const DEFAULT_MODEL = 'openrouter/anthropic/claude-opus-4'

interface CliOptions {
  promptFile?: string
  task?: string
  model: string
  branchStrategy: BranchStrategy
  attachKlickerNetwork: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    model: process.env.SANDCASTLE_MODEL ?? DEFAULT_MODEL,
    branchStrategy: { type: 'merge-to-head' },
    attachKlickerNetwork: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--prompt' || a === '-p') opts.promptFile = argv[++i]
    else if (a === '--task' || a === '-t') opts.task = argv[++i]
    else if (a === '--model' || a === '-m') opts.model = argv[++i]
    else if (a === '--branch')
      opts.branchStrategy = { type: 'branch', branch: argv[++i] }
    else if (a === '--head') opts.branchStrategy = { type: 'head' }
    else if (a === '--with-services') opts.attachKlickerNetwork = true
    else if (!opts.promptFile && !a.startsWith('-')) opts.promptFile = a
  }
  return opts
}

function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
  return v
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  const promptFile = opts.promptFile
    ? resolve(process.cwd(), opts.promptFile)
    : resolve(process.cwd(), '.sandcastle/prompt.md')

  const task =
    opts.task ??
    process.env.SANDCASTLE_TASK ??
    'List the top-level directories of the repo and report Node + pnpm versions.'

  const forwardedEnv: Record<string, string> = {
    OPENROUTER_API_KEY: requireEnv('OPENROUTER_API_KEY'),
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
    network: opts.attachKlickerNetwork ? 'klicker-uzh_klicker' : undefined,
  })

  const agent = opencode(opts.model)

  await run({
    agent,
    sandbox,
    promptFile,
    promptArgs: { TASK: task },
    branchStrategy: opts.branchStrategy,
    hooks: {
      sandbox: {
        onSandboxReady: [
          { command: 'pnpm install --frozen-lockfile', timeoutMs: 15 * 60_000 },
          {
            command: 'pnpm --filter @klicker-uzh/prisma generate',
            timeoutMs: 5 * 60_000,
          },
          {
            command: 'pnpm --filter @klicker-uzh/graphql generate',
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
