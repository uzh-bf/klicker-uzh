import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import builder from '../src/builder.js'

// Pothos loads GraphQL through CommonJS; execute with that same module instance.
const { graphql } = createRequire(import.meta.url)(
  'graphql'
) as typeof import('graphql')

beforeEach(() => vi.clearAllMocks())

const resolve = vi.fn((_root: unknown, { limit }: { limit: number }) => limit)

builder.queryType({
  fields: (t) => ({
    syntheticLimit: t.int({
      args: {
        limit: t.arg.int({ required: true, validate: { min: 1, max: 5 } }),
      },
      resolve,
    }),
  }),
})
const schema = builder.toSchema()

describe('GraphQL input validation integration', () => {
  it('rejects out-of-range arguments before dispatch and preserves the error envelope', async () => {
    for (const limit of [0, 6]) {
      const result = await graphql({
        schema,
        source: 'query($limit: Int!) { syntheticLimit(limit: $limit) }',
        variableValues: { limit },
        contextValue: {},
      })
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0]?.path).toEqual(['syntheticLimit'])
      expect(result.errors?.[0]?.originalError).toBeInstanceOf(Error)
    }
    expect(resolve).not.toHaveBeenCalled()
  })

  it('passes valid arguments through unchanged', async () => {
    const result = await graphql({
      schema,
      source: '{ syntheticLimit(limit: 3) }',
      contextValue: {},
    })
    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ syntheticLimit: 3 })
    expect(resolve).toHaveBeenCalledOnce()
  })
})
