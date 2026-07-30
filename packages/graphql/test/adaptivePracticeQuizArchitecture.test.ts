import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const servicesDirectory = fileURLToPath(
  new URL('../src/services/', import.meta.url)
)
const schemaDirectory = fileURLToPath(
  new URL('../src/schema/', import.meta.url)
)
const facadeLimits = new Map([
  ['adaptivePracticeQuizConfig.ts', 250],
  ['adaptivePracticeQuizzes.ts', 250],
  ['competenceTreeManagement.ts', 250],
])
const publicFacades = new Set([
  'adaptivePracticeQuizConfig',
  'adaptivePracticeQuizzes',
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
})

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
