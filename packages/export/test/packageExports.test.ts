import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

type PackageExport = {
  types?: string
  default?: string
}

describe('@klicker-uzh/export package contract', () => {
  it.each([
    ['.', './dist/index.d.ts', './dist/index.js'],
    [
      './correlated-live-quiz-responses',
      './dist/correlatedLiveQuizResponses.d.ts',
      './dist/correlatedLiveQuizResponses.js',
    ],
  ])('exposes %s to type and runtime resolvers', (entry, types, runtime) => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as {
      exports: Record<string, PackageExport>
    }

    expect(packageJson.exports[entry]).toEqual({
      types,
      default: runtime,
    })
  })
})
