import { readFileSync } from 'node:fs'
import {
  buildSchema,
  type GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isObjectType,
} from 'graphql'
import { beforeAll, describe, expect, it } from 'vitest'

describe('unified element-generation GraphQL contract', () => {
  let schema: GraphQLSchema

  beforeAll(() => {
    schema = buildSchema(
      readFileSync(
        new URL('../src/public/schema.graphql', import.meta.url),
        'utf8'
      )
    )
  })

  it('exposes one lifecycle for every generatable Klicker element type', () => {
    const queryFields = schema.getQueryType()?.getFields()
    const mutationFields = schema.getMutationType()?.getFields()

    expect(queryFields).toMatchObject({
      elementGenerationBuild: expect.any(Object),
      elementGenerationCapabilities: expect.any(Object),
      elementGenerationSources: expect.any(Object),
    })
    expect(mutationFields).toMatchObject({
      startElementGeneration: expect.any(Object),
      reviewElementGeneration: expect.any(Object),
      updateGeneratedElementDraft: expect.any(Object),
      duplicateGeneratedElementDraft: expect.any(Object),
      setGeneratedElementDecision: expect.any(Object),
      keepGeneratedElementDraft: expect.any(Object),
      saveGeneratedElements: expect.any(Object),
      retryElementGeneration: expect.any(Object),
      publishIncompleteElementGeneration: expect.any(Object),
    })

    const elementType = schema.getType('GeneratableElementType')
    expect(isEnumType(elementType)).toBe(true)
    if (!isEnumType(elementType))
      throw new Error('Element type enum is missing')
    expect(
      elementType
        .getValues()
        .map((value) => value.name)
        .sort()
    ).toEqual(['FLASHCARD', 'KPRIM', 'MC', 'SC'])
  })

  it('uses the native graph build identity and no provider-specific API', () => {
    const startInput = schema.getType('StartElementGenerationInput')
    expect(isInputObjectType(startInput)).toBe(true)
    if (!isInputObjectType(startInput)) {
      throw new Error('StartElementGenerationInput is missing')
    }
    expect(startInput.getFields().graphBuildId?.type.toString()).toBe('ID!')
    expect(startInput.getFields()).not.toHaveProperty('graphVersionId')

    const build = schema.getType('ElementGenerationBuild')
    expect(isObjectType(build)).toBe(true)
    if (!isObjectType(build))
      throw new Error('ElementGenerationBuild is missing')
    expect(build.getFields().graphBuildId?.type.toString()).toBe('ID!')
    expect(build.getFields().sources?.type.toString()).toBe(
      '[ElementGenerationBuildSource!]!'
    )

    const keep = schema.getMutationType()?.getFields().keepGeneratedElementDraft
    expect(keep?.args.map((argument) => argument.name)).toEqual(
      expect.arrayContaining([
        'draftId',
        'expectedRevision',
        'status',
        'type',
        'name',
        'content',
        'basePoints',
        'pointsMultiplier',
        'choiceIds',
      ])
    )

    const publicFields = [
      ...Object.keys(schema.getQueryType()?.getFields() ?? {}),
      ...Object.keys(schema.getMutationType()?.getFields() ?? {}),
    ]
    expect(publicFields).not.toEqual(
      expect.arrayContaining([
        'questionGenerationBuild',
        'flashcardGenerationBuild',
        'startQuestionGeneration',
        'startFlashcardGeneration',
        'saveGeneratedQuestions',
        'saveGeneratedFlashcards',
      ])
    )
  })
})
