import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

const sourceDirectories = [
  '/external/catalyst/packages/adaptive-server/',
  '/external/catalyst/packages/adaptive-persistence/',
]
const isSourceFile = (id) =>
  sourceDirectories.some((directory) => id.includes(directory))

export function isCatalystSource(id) {
  return (
    id.startsWith('@klicker-uzh/adaptive-server/') ||
    id.startsWith('@klicker-uzh/adaptive-persistence/') ||
    isSourceFile(id)
  )
}

// Host tsc checks these source-package imports. Rollup also needs to emit their
// runtime code: TypeScript treats node_modules workspace links as external
// libraries and only emits the host's own source files.
export function catalystSource() {
  return {
    name: 'catalyst-source',
    resolveId(specifier, importer) {
      if (!importer || !isSourceFile(importer) || !specifier.startsWith('.'))
        return null
      const candidate = resolve(
        dirname(importer),
        specifier.replace(/\.js$/, '.ts')
      )
      return existsSync(candidate) ? candidate : null
    },
    transform(code, id) {
      if (!isSourceFile(id) || !id.endsWith('.ts')) return null
      const output = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          sourceMap: true,
          inlineSources: true,
        },
      })
      return {
        code: output.outputText,
        map: output.sourceMapText ? JSON.parse(output.sourceMapText) : null,
      }
    },
  }
}
