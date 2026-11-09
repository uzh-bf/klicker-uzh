import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const forbiddenPublicSimulationTerms =
  /(?:simulateAdaptive|adaptiveSimulation|bankValidation(?:Request|Report|Status|Seed|Trace|Metric))/i
const hostRoot = requiredHostRoot()

describe('adaptive simulation boundary', () => {
  it('keeps internal simulation controls out of GraphQL and product operations', () => {
    const publicSchema = readFileSync(
      join(hostRoot, 'packages/graphql/src/public/schema.graphql'),
      'utf8'
    )
    const operations = [
      join(hostRoot, 'packages/graphql/src/graphql/ops'),
      join(import.meta.dirname, '../src/graphql/ops'),
    ]
      .flatMap((directory) => readGraphqlOperations(directory))
      .join('\n')

    expect(publicSchema).not.toMatch(forbiddenPublicSimulationTerms)
    expect(operations).not.toMatch(forbiddenPublicSimulationTerms)
  })
})

function requiredHostRoot() {
  const hostRoot = process.env.KLICKER_HOST_ROOT
  if (!hostRoot) {
    throw new Error('KLICKER_HOST_ROOT is required to inspect the public SDL.')
  }
  return hostRoot
}

function readGraphqlOperations(directory: string) {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.graphql'))
    .map((file) => readFileSync(join(directory, file), 'utf8'))
}
