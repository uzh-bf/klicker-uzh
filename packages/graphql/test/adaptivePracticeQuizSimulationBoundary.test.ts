import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const forbiddenPublicSimulationTerms =
  /(?:simulateAdaptive|adaptiveSimulation|bankValidation(?:Request|Report|Status|Seed|Trace|Metric))/i

describe('adaptive simulation boundary', () => {
  it('keeps internal simulation controls out of GraphQL and product operations', () => {
    const publicSchema = readFileSync(
      join(import.meta.dirname, '../src/public/schema.graphql'),
      'utf8'
    )
    const operations = readdirSync(
      join(import.meta.dirname, '../src/graphql/ops')
    )
      .filter((file) => file.endsWith('.graphql'))
      .map((file) =>
        readFileSync(
          join(import.meta.dirname, '../src/graphql/ops', file),
          'utf8'
        )
      )
      .join('\n')

    expect(publicSchema).not.toMatch(forbiddenPublicSimulationTerms)
    expect(operations).not.toMatch(forbiddenPublicSimulationTerms)
  })
})
