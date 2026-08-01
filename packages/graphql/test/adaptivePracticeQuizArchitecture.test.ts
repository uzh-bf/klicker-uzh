import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const servicesDirectory = fileURLToPath(
  new URL('../src/services/', import.meta.url)
)
const schemaDirectory = fileURLToPath(
  new URL('../src/schema/', import.meta.url)
)
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const facadeLimits = new Map([
  ['adaptivePracticeQuizConfig.ts', 250],
  ['adaptivePracticeQuizzes.ts', 250],
  ['competenceTreeCalibration.ts', 250],
  ['competenceTreeManagement.ts', 250],
])
const publicFacades = new Set([
  'adaptivePracticeQuizConfig',
  'adaptivePracticeQuizzes',
  'competenceTreeCalibration',
  'competenceTreeCalibrationExport',
  'competenceTreeCalibrationReadModels',
  'competenceTreeManagement',
  // Pure validation contracts are intentionally schema-visible.
  'competenceTrees',
])

describe('adaptive learning service architecture', () => {
  it('keeps facades small and implementation modules reviewable', async () => {
    const modules = await loadAdaptiveServiceModules()

    for (const module of modules.values()) {
      const limit = facadeLimits.get(module.name) ?? 700
      expect(
        module.lineCount,
        `${module.name} exceeds the ${limit}-line module boundary`
      ).toBeLessThanOrEqual(limit)
      expect(module.source).not.toMatch(
        /from ['"]react['"]|require\(['"]react['"]\)/
      )
    }
  })

  it('keeps adaptive service dependencies acyclic and away from public facades', async () => {
    const modules = await loadAdaptiveServiceModules()
    const graph = new Map<string, string[]>()

    for (const module of modules.values()) {
      const dependencies = Array.from(
        module.source.matchAll(
          /from ['"]\.\/((?:adaptivePracticeQuiz|competenceTree)[^'"]+)\.js['"]/g
        ),
        (match) => `${match[1]}.ts`
      ).filter((dependency) => modules.has(dependency))
      graph.set(module.name, dependencies)

      if (!facadeLimits.has(module.name)) {
        for (const facade of facadeLimits.keys()) {
          expect(dependencies).not.toContain(facade)
        }
      }
    }

    expect(findCycle(graph)).toBeNull()
  })

  it('routes schema imports through public adaptive service facades', async () => {
    const names = (await readdir(schemaDirectory)).filter((name) =>
      name.endsWith('.ts')
    )

    for (const name of names) {
      const source = await readFile(`${schemaDirectory}/${name}`, 'utf8')
      const serviceImports = Array.from(
        source.matchAll(
          /from ['"]\.\.\/services\/((?:adaptivePracticeQuiz|competenceTree)[^'"]+)\.js['"]/g
        ),
        (match) => match[1]!
      )
      expect(
        serviceImports.filter((moduleName) => !publicFacades.has(moduleName)),
        `${name} imports an adaptive service implementation directly`
      ).toEqual([])
    }
  })

  it('keeps the legacy standalone adaptive assessment quarantined', async () => {
    const productSurfaceDirectories = [
      'packages/graphql/src/schema',
      'packages/graphql/src/graphql/ops',
      'apps/frontend-manage/src',
      'apps/frontend-pwa/src',
      'apps/frontend-control/src',
    ]
    const productSources = await Promise.all(
      productSurfaceDirectories.map((directory) =>
        readSourceTree(`${repositoryRoot}/${directory}`)
      )
    )

    expect(productSources.join('\n')).not.toMatch(/AdaptiveAssessment/)

    const seed = await readAdaptiveSeedSources()
    expect(seed).not.toMatch(/AdaptiveAssessment|adaptiveAssessment/)
    expect(seed).toMatch(
      /await\s+seedAdaptivePracticeQuizV2\(prisma,\s*PARTICIPANT_IDS\)/
    )
  })

  it('keeps the adaptive development seed on the immutable publication path', async () => {
    const seed = await readAdaptiveSeedSources()

    expect(seed).toContain('competenceTreeScaleVersion.create')
    expect(seed).toContain('adaptiveItemCalibration.create')
    expect(seed).toContain('practiceQuizAdaptivePublication.create')
    expect(seed).toContain('practiceQuizAdaptivePoolItem.createMany')
    expect(seed).toContain('adaptivePracticeQuizItemExposure.createMany')
    expect(seed).toContain('data: { sealedAt: publicationTimestamp }')
  })

  it('keeps estimator-specific response planning outside the submission transaction', async () => {
    const commandSource = await readFile(
      `${servicesDirectory}/adaptivePracticeQuizCommands.ts`,
      'utf8'
    )
    const transitionSource = await readFile(
      `${servicesDirectory}/adaptivePracticeQuizResponseTransition.ts`,
      'utf8'
    )
    const submissionSource = commandSource.slice(
      commandSource.indexOf(
        'export async function submitAdaptivePracticeQuizResponse'
      ),
      commandSource.indexOf(
        'export async function abandonAdaptivePracticeQuizAttempt'
      )
    )

    expect(submissionSource).toContain(
      'planAdaptivePracticeQuizResponseTransition'
    )
    expect(submissionSource).not.toContain('measurementVersion')
    expect(transitionSource).toContain(
      'advancedRuntime: AdvancedAdaptiveRuntime'
    )
    expect(
      transitionSource.match(
        /if \(advancedRuntime\.measurementVersion === 'IRT_V1'\)/g
      )
    ).toHaveLength(1)
    expect(transitionSource).not.toContain(
      'loadedDecision: LoadedAdaptiveDecision'
    )
  })
})

async function readAdaptiveSeedSources() {
  return (
    await Promise.all(
      ['seedTEST.ts', 'seedAdaptiveLearning.ts'].map((name) =>
        readFile(
          `${repositoryRoot}/packages/prisma-data/src/data/${name}`,
          'utf8'
        )
      )
    )
  ).join('\n')
}

async function readSourceTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true })
  const sources = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) return readSourceTree(path)
      if (!/\.(graphql|ts|tsx)$/.test(entry.name)) return ''
      return readFile(path, 'utf8')
    })
  )
  return sources.join('\n')
}

async function loadAdaptiveServiceModules() {
  const names = (await readdir(servicesDirectory)).filter(
    (name) =>
      (name.startsWith('adaptivePracticeQuiz') ||
        name.startsWith('competenceTree')) &&
      name.endsWith('.ts')
  )
  const entries = await Promise.all(
    names.map(async (name) => {
      const source = await readFile(`${servicesDirectory}/${name}`, 'utf8')
      return [
        name,
        {
          name,
          source,
          lineCount: source.trimEnd().split('\n').length,
        },
      ] as const
    })
  )
  return new Map(entries)
}

function findCycle(graph: Map<string, string[]>): string[] | null {
  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []

  function visit(moduleName: string): string[] | null {
    if (active.has(moduleName)) {
      const start = path.indexOf(moduleName)
      return [...path.slice(start), moduleName]
    }
    if (visited.has(moduleName)) return null

    visited.add(moduleName)
    active.add(moduleName)
    path.push(moduleName)
    for (const dependency of graph.get(moduleName) ?? []) {
      const cycle = visit(dependency)
      if (cycle) return cycle
    }
    path.pop()
    active.delete(moduleName)
    return null
  }

  for (const moduleName of graph.keys()) {
    const cycle = visit(moduleName)
    if (cycle) return cycle
  }
  return null
}
