import {
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLUnionType,
} from 'graphql'
import { describe, expect, it } from 'vitest'
import { schema } from '../src/index.js'

function fieldNames(typeName: string) {
  const type = schema.getType(typeName)
  expect(type?.constructor.name).toBe('GraphQLObjectType')
  return Object.keys((type as GraphQLObjectType).getFields())
}

describe('CODE GraphQL contracts', () => {
  it('separates lecturer authoring fields from participant element data', () => {
    expect(fieldNames('CodeElementOptions')).toEqual(
      expect.arrayContaining([
        'sampleSolution',
        'testCases',
        'hasSampleSolution',
      ])
    )
    expect(fieldNames('CodeTestCase')).toEqual(
      expect.arrayContaining(['args', 'expectedOutput', 'visibility', 'weight'])
    )

    expect(fieldNames('PublicCodeElementOptions')).not.toEqual(
      expect.arrayContaining(['sampleSolution', 'hasSampleSolution'])
    )
    expect(fieldNames('PublicCodeTestCase')).toEqual([
      'args',
      'expectedOutput',
      'id',
      'name',
    ])
  })

  it('registers CODE in every contract union and exposes authoring input', () => {
    for (const [unionName, memberName] of [
      ['Element', 'CodeElement'],
      ['ElementData', 'CodeElementData'],
      ['InstanceEvaluation', 'CodeInstanceEvaluation'],
      ['ElementInstanceEvaluation', 'CodeActivityEvaluationData'],
    ] as const) {
      const union = schema.getType(unionName)
      expect(union?.constructor.name).toBe('GraphQLUnionType')
      expect(
        (union as GraphQLUnionType).getTypes().map((type) => type.name)
      ).toContain(memberName)
    }

    const input = schema.getType('OptionsCodeInput')
    expect(input?.constructor.name).toBe('GraphQLInputObjectType')
    expect(Object.keys((input as GraphQLInputObjectType).getFields())).toEqual(
      expect.arrayContaining(['entrypoint', 'testCases', 'language'])
    )

    const responseInput = schema.getType('StackResponseInput')
    expect(responseInput?.constructor.name).toBe('GraphQLInputObjectType')
    expect(
      Object.keys((responseInput as GraphQLInputObjectType).getFields())
    ).toContain('codeResponse')

    expect(schema.getMutationType()?.getFields()).toHaveProperty(
      'manipulateCodeQuestion'
    )
    expect(schema.getType('CodeSubmissionReceipt')?.constructor.name).toBe(
      'GraphQLObjectType'
    )
  })
})
