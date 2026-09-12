import {
  buildSchema,
  getNamedType,
  GraphQLObjectType,
  GraphQLUnionType,
  print,
} from 'graphql'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ValidateElementImportPackageDocument } from '../src/ops.js'

describe('element import preview response shape', () => {
  it('exposes a shared answer pool once and selected item ids without repeated values', () => {
    const operation = print(ValidateElementImportPackageDocument)

    expect(operation.match(/\bentries\b/g)).toHaveLength(1)
    expect(operation).toContain('answerCollectionItemIds')
    expect(operation).not.toContain('answerCollectionItems')
    expect(operation).not.toContain('answerCollectionEntries')
  })

  it('does not expose per-element answer-pool or selected-value expansion fields', () => {
    const schema = buildSchema(
      readFileSync(new URL('../src/public/schema.graphql', import.meta.url), {
        encoding: 'utf8',
      })
    )
    const previewElement = schema.getType(
      'ElementImportPackagePreviewElement'
    ) as GraphQLObjectType
    const fields = previewElement.getFields()

    expect(fields.answerCollectionItemIds).toBeDefined()
    expect(fields.answerCollectionItems).toBeUndefined()
    expect(fields.answerCollectionEntries).toBeUndefined()
  })

  it('uses a nine-member typed options union instead of the Json scalar', () => {
    const schema = buildSchema(
      readFileSync(new URL('../src/public/schema.graphql', import.meta.url), {
        encoding: 'utf8',
      })
    )
    const previewElement = schema.getType(
      'ElementImportPackagePreviewElement'
    ) as GraphQLObjectType
    const optionsType = getNamedType(previewElement.getFields().options!.type)

    expect(optionsType).toBeInstanceOf(GraphQLUnionType)
    expect(
      (optionsType as GraphQLUnionType)
        .getTypes()
        .map(({ name }) => name)
        .sort()
    ).toEqual(
      [
        'ElementImportPackagePreviewSCOptions',
        'ElementImportPackagePreviewMCOptions',
        'ElementImportPackagePreviewKPRIMOptions',
        'ElementImportPackagePreviewNumericalOptions',
        'ElementImportPackagePreviewFreeTextOptions',
        'ElementImportPackagePreviewContentOptions',
        'ElementImportPackagePreviewFlashcardOptions',
        'ElementImportPackagePreviewSelectionOptions',
        'ElementImportPackagePreviewCaseStudyOptions',
      ].sort()
    )
    expect(optionsType.name).toBe('ElementImportPackagePreviewOptions')
    expect(optionsType.name).not.toBe('Json')
  })

  it('generates inline fragments for every option type and every transferable field', () => {
    const operation = print(ValidateElementImportPackageDocument)
    const concreteTypes = [
      'SC',
      'MC',
      'KPRIM',
      'Numerical',
      'FreeText',
      'Content',
      'Flashcard',
      'Selection',
      'CaseStudy',
    ]

    for (const concreteType of concreteTypes) {
      expect(operation).toContain(
        `... on ElementImportPackagePreview${concreteType}Options`
      )
    }

    for (const field of [
      'displayMode',
      'hasSampleSolution',
      'hasAnswerFeedbacks',
      'choices',
      'correct',
      'feedback',
      'accuracy',
      'placeholder',
      'unit',
      'restrictions',
      'solutionRanges',
      'exactSolutions',
      'solutions',
      'numberOfInputs',
      'criteria',
      'labels',
      'cases',
      'criteriaSolutions',
    ]) {
      expect(operation).toMatch(new RegExp(`\\b${field}\\b`))
    }

    const generatedOperations = readFileSync(
      new URL('../src/ops.ts', import.meta.url),
      { encoding: 'utf8' }
    )
    const generatedPreviewStart = generatedOperations.indexOf(
      'export type ValidateElementImportPackageMutation ='
    )
    const generatedPreviewEnd = generatedOperations.indexOf(
      '\n\n',
      generatedPreviewStart
    )
    const generatedPreview = generatedOperations.slice(
      generatedPreviewStart,
      generatedPreviewEnd
    )

    expect(generatedPreviewStart).toBeGreaterThanOrEqual(0)
    expect(generatedPreview).not.toMatch(/\bany\b/)
  })
})
