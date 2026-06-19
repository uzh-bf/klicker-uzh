import { spawnSync } from 'child_process'
import { createHash } from 'crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, join, resolve } from 'path'
import { parse, stringify } from 'yaml'

type CliArgs = Record<string, string | boolean>

const DEFAULT_TASKS = [
  'student_solution_correctness.yaml',
  'mistake_location.yaml',
  'mistake_correction.yaml',
  'socratic_questioning.yaml',
  'scaffolding_generation.yaml',
  'pedagogy_following.yaml',
]

const PROMPT_VARIANTS = {
  current: 'packages/prisma-data/src/data/data/tutorMode.txt',
  'tutor-skills-v1': 'packages/prisma-data/src/data/data/tutorModeSkillsV1.txt',
  'chat-api-runtime': null,
}

const BENCHMARK_BRIDGE = [
  'You are being evaluated with MathTutorBench.',
  'Apply the tutor policy above where it does not conflict with the benchmark task.',
  'If the benchmark task asks for an exact output format, follow that format exactly.',
].join(' ')

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }

    args[key] = next
    i += 1
  }
  return args
}

function findRepoRoot(start: string): string {
  let current = resolve(start)
  while (current !== '/') {
    if (
      existsSync(join(current, 'package.json')) &&
      existsSync(join(current, 'packages/prisma-data'))
    ) {
      return current
    }
    current = resolve(current, '..')
  }
  throw new Error('Could not find repository root')
}

function splitCsv(value: string | boolean | undefined, fallback: string[]) {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function redactModelArgs(modelArgs: string) {
  return modelArgs
    .split(',')
    .map((pair) => {
      const [key] = pair.split('=')
      return key.toLowerCase().includes('key') ? `${key}=<redacted>` : pair
    })
    .join(',')
}

function copyBenchmark(src: string, dest: string) {
  cpSync(src, dest, {
    recursive: true,
    filter: (source) => {
      const name = basename(source)
      return ![
        '.git',
        '.venv',
        '__pycache__',
        '.pytest_cache',
        'results',
      ].includes(name)
    },
  })
}

function generateConfigs({
  benchmarkDir,
  tasks,
  prompt,
}: {
  benchmarkDir: string
  tasks: string[]
  prompt: string | null
}) {
  for (const task of tasks) {
    const configPath = join(benchmarkDir, 'configs', task)
    if (!existsSync(configPath)) {
      throw new Error(`Task config not found: ${configPath}`)
    }

    const config = parse(readFileSync(configPath, 'utf-8')) as {
      system_prompt?: string
    }

    if (typeof config.system_prompt !== 'string') {
      throw new Error(`Task config has no system_prompt: ${configPath}`)
    }

    if (prompt !== null) {
      config.system_prompt = [
        prompt.trim(),
        '',
        BENCHMARK_BRIDGE,
        '',
        config.system_prompt.trim(),
      ].join('\n')
    }

    writeFileSync(configPath, stringify(config), 'utf-8')
  }
}

function patchBenchmarkMaxExamples({
  benchmarkDir,
  maxExamples,
}: {
  benchmarkDir: string
  maxExamples: number | null
}) {
  if (maxExamples === null) return

  const mainPath = join(benchmarkDir, 'main.py')
  let source = readFileSync(mainPath, 'utf-8')

  if (!source.includes('import os\n')) {
    source = source.replace('import json\n', 'import json\nimport os\n')
  }

  const needle =
    '        for example in tqdm(task.get_test_examples(), desc=f"Evaluating {task_config.name}"):\n'
  const replacement = [
    '        examples = task.get_test_examples()',
    '        max_examples = int(os.environ.get("MATHTUTORBENCH_MAX_EXAMPLES", "0"))',
    '        if max_examples > 0:',
    '            examples = examples[:max_examples]',
    '        for example in tqdm(examples, desc=f"Evaluating {task_config.name}"):',
    '',
  ].join('\n')

  if (!source.includes(needle)) {
    throw new Error('Could not patch MathTutorBench main.py for --max-examples')
  }

  source = source.replace(needle, replacement)
  writeFileSync(mainPath, source, 'utf-8')
}

function patchBenchmarkCompatibility(benchmarkDir: string) {
  for (const task of ['problem_solving.yaml', 'socratic_questioning.yaml']) {
    const configPath = join(benchmarkDir, 'configs', task)
    if (!existsSync(configPath)) continue

    const source = readFileSync(configPath, 'utf-8')
    writeFileSync(
      configPath,
      source.replace(/^dataset_path: gsm8k$/m, 'dataset_path: openai/gsm8k'),
      'utf-8'
    )
  }
}

function writeManifest({
  manifestPath,
  dryRun,
  variant,
  promptPath,
  prompt,
  tasks,
  provider,
  modelArgs,
  command,
  benchmarkSource,
  outputDir,
  maxExamples,
}: {
  manifestPath: string
  dryRun: boolean
  variant: string
  promptPath: string | null
  prompt: string | null
  tasks: string[]
  provider: string
  modelArgs: string
  command: string[]
  benchmarkSource: string | null
  outputDir: string
  maxExamples: number | null
}) {
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        dryRun,
        variant,
        promptPath,
        promptSha256: prompt === null ? null : sha256(prompt),
        promptChars: prompt === null ? null : prompt.length,
        tasks,
        provider,
        modelArgs: redactModelArgs(modelArgs),
        command,
        benchmarkSource,
        outputDir,
        maxExamples,
        sources: {
          benchmarkSite: 'https://eth-lre.github.io/mathtutorbench/',
          benchmarkRepo: 'https://github.com/eth-lre/mathtutorbench',
        },
      },
      null,
      2
    ),
    'utf-8'
  )
}

function runVariant({
  repoRoot,
  variant,
  tasks,
  outputRoot,
  benchmarkDir,
  provider,
  modelArgs,
  python,
  dryRun,
  maxExamples,
}: {
  repoRoot: string
  variant: string
  tasks: string[]
  outputRoot: string
  benchmarkDir: string | null
  provider: string
  modelArgs: string
  python: string
  dryRun: boolean
  maxExamples: number | null
}) {
  const promptPath = PROMPT_VARIANTS[variant as keyof typeof PROMPT_VARIANTS]
  if (promptPath === undefined) {
    throw new Error(
      `Unknown prompt variant "${variant}". Known: ${Object.keys(
        PROMPT_VARIANTS
      ).join(', ')}`
    )
  }

  const prompt =
    promptPath === null
      ? null
      : readFileSync(join(repoRoot, promptPath), 'utf-8').trim()
  const variantDir = join(outputRoot, variant)
  mkdirSync(variantDir, { recursive: true })

  const benchmarkRunDir =
    benchmarkDir === null ? null : join(variantDir, 'mathtutorbench')
  const upstreamOutputDir = join(variantDir, 'upstream-results')
  const command = [
    python,
    'main.py',
    '--tasks',
    tasks.join(','),
    '--provider',
    provider,
    '--model_args',
    modelArgs,
    '--output',
    upstreamOutputDir,
  ]
  const manifestCommand = command.map((part, index) =>
    index > 0 && command[index - 1] === '--model_args'
      ? redactModelArgs(part)
      : part
  )

  if (!dryRun) {
    if (benchmarkDir === null) {
      throw new Error(
        'Non-dry run requires --benchmark-dir or MATHTUTORBENCH_DIR'
      )
    }
    if (!existsSync(join(benchmarkDir, 'main.py'))) {
      throw new Error(`MathTutorBench main.py not found in ${benchmarkDir}`)
    }

    copyBenchmark(benchmarkDir, benchmarkRunDir!)
    patchBenchmarkCompatibility(benchmarkRunDir!)
    generateConfigs({
      benchmarkDir: benchmarkRunDir!,
      tasks,
      prompt,
    })
    patchBenchmarkMaxExamples({
      benchmarkDir: benchmarkRunDir!,
      maxExamples,
    })

    mkdirSync(upstreamOutputDir, { recursive: true })
    const child = spawnSync(command[0], command.slice(1), {
      cwd: benchmarkRunDir!,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(maxExamples === null
          ? {}
          : { MATHTUTORBENCH_MAX_EXAMPLES: String(maxExamples) }),
      },
    })

    if (child.status !== 0) {
      throw new Error(`MathTutorBench exited with ${child.status}`)
    }
  }

  writeManifest({
    manifestPath: join(variantDir, 'manifest.json'),
    dryRun,
    variant,
    promptPath,
    prompt,
    tasks,
    provider,
    modelArgs,
    command: manifestCommand,
    benchmarkSource: benchmarkDir,
    outputDir: upstreamOutputDir,
    maxExamples,
  })
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const repoRoot = findRepoRoot(process.cwd())
  const dryRun = args['dry-run'] === true
  const runId =
    typeof args['run-id'] === 'string' && args['run-id'].length > 0
      ? args['run-id']
      : timestamp()
  const outputRoot = resolve(
    repoRoot,
    typeof args['output-dir'] === 'string'
      ? args['output-dir']
      : join('project/evals/results', runId)
  )
  const variants = splitCsv(args.variants, ['current', 'tutor-skills-v1'])
  const tasks = splitCsv(args.tasks, DEFAULT_TASKS)
  const benchmarkDir =
    typeof args['benchmark-dir'] === 'string'
      ? resolve(args['benchmark-dir'])
      : process.env.MATHTUTORBENCH_DIR
        ? resolve(process.env.MATHTUTORBENCH_DIR)
        : null
  const provider =
    typeof args.provider === 'string' ? args.provider : 'completion_api'
  const modelArgs =
    typeof args['model-args'] === 'string'
      ? args['model-args']
      : 'model=gpt-4o-mini-2024-07-18,is_chat=true,temperature=0,max_tokens=2048'
  const python = typeof args.python === 'string' ? args.python : 'python'
  const maxExamples =
    typeof args['max-examples'] === 'string'
      ? Number(args['max-examples'])
      : null

  if (
    maxExamples !== null &&
    (!Number.isInteger(maxExamples) || maxExamples < 1)
  ) {
    throw new Error('--max-examples must be a positive integer')
  }

  mkdirSync(outputRoot, { recursive: true })

  for (const variant of variants) {
    runVariant({
      repoRoot,
      variant,
      tasks,
      outputRoot,
      benchmarkDir,
      provider,
      modelArgs,
      python,
      dryRun,
      maxExamples,
    })
  }

  console.log(`MathTutorBench harness ${dryRun ? 'dry run' : 'run'} complete`)
  console.log(outputRoot)
}

main()
