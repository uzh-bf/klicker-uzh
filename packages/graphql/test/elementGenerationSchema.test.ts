import { readFileSync } from 'node:fs'
import {
  buildSchema,
  type GraphQLObjectType,
  type GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isObjectType,
} from 'graphql'
import { beforeAll, describe, expect, it } from 'vitest'
import { schema as runtimeSchema } from '../src/index.js'

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

  it('exposes structured slot failures while keeping reason codes open', () => {
    const build = schema.getType('ElementGenerationBuild')
    expect(isObjectType(build)).toBe(true)
    if (!isObjectType(build))
      throw new Error('ElementGenerationBuild is missing')
    expect(build.getFields().slotFailures?.type.toString()).toBe(
      '[ElementGenerationSlotFailure!]!'
    )

    const failure = schema.getType('ElementGenerationSlotFailure')
    expect(isObjectType(failure)).toBe(true)
    if (!isObjectType(failure))
      throw new Error('ElementGenerationSlotFailure is missing')
    // The reason code stays a plain string: a newer worker release must be
    // able to report a code this schema does not know yet.
    expect(failure.getFields().reasonCode?.type.toString()).toBe('String!')
    expect(failure.getFields().failureClass?.type.toString()).toBe(
      'ElementGenerationFailureClass!'
    )
    expect(failure.getFields().moduleId?.type.toString()).toBe('String')
    expect(failure.getFields().objective?.type.toString()).toBe('String')
    expect(failure.getFields().objectiveSource?.type.toString()).toBe(
      'ElementGenerationObjectiveSource'
    )
    expect(failure.getFields().requestedLevel?.type.toString()).toBe(
      'ElementGenerationBloomLevel'
    )
    expect(failure.getFields().evidenceTarget?.type.toString()).toBe('String')
    expect(failure.getFields().detail?.type.toString()).toBe('String')
    expect(failure.getFields().suggestions?.type.toString()).toBe('[String!]!')

    const failureClass = schema.getType('ElementGenerationFailureClass')
    expect(isEnumType(failureClass)).toBe(true)
    if (!isEnumType(failureClass))
      throw new Error('ElementGenerationFailureClass is missing')
    expect(
      failureClass
        .getValues()
        .map((value) => value.name)
        .sort()
    ).toEqual(['self_repairable', 'system', 'user_input'])
  })

  it('defaults the slot failure list of a build persisted without it', async () => {
    // The runtime schema is built by Pothos outside this test's GraphQL module
    // realm, so the field is read through the type cast instead of a runtime
    // type guard.
    const build = runtimeSchema.getType(
      'ElementGenerationBuild'
    ) as GraphQLObjectType
    const resolve = build.getFields().slotFailures?.resolve
    expect(resolve).toBeDefined()
    // A persisted build row carries no slot failure list, and the field is a
    // non-null list, so the resolver has to default it for every build that is
    // not read back from a result manifest.
    expect(await resolve!({} as never, {}, {} as never, {} as never)).toEqual(
      []
    )
  })
})
