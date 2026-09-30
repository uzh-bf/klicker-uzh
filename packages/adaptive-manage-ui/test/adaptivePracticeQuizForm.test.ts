import {
  AdaptivePracticeQuizPreset,
  PracticeQuizMode,
} from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, test } from 'vitest'
import {
  createAdaptivePracticeQuizDefaultConfig,
  applyPlacementPilotDefaults,
  getAdaptivePracticeQuizEffectiveSettings,
  getAuthorableAdaptivePresets,
  isManageAdaptivePresetSelectable,
  serializeAdaptivePracticeQuizConfig,
} from '../src/components/activities/creation/practiceQuiz/adaptivePracticeQuizForm'

describe('adaptive practice quiz Manage form', () => {
  test('offers only IRT v1 presets while v2 authoring is hidden', () => {
    expect(
      getAuthorableAdaptivePresets(AdaptivePracticeQuizPreset.Diagnostic)
    ).toEqual([
      AdaptivePracticeQuizPreset.Diagnostic,
      AdaptivePracticeQuizPreset.Research,
    ])
    expect(
      getAuthorableAdaptivePresets(AdaptivePracticeQuizPreset.Placement)
    ).toEqual([
      AdaptivePracticeQuizPreset.Diagnostic,
      AdaptivePracticeQuizPreset.Research,
      AdaptivePracticeQuizPreset.Placement,
    ])
  })

  test.each([
    '1.28',
    '1.645',
    '1.96',
  ])('keeps the 50-question default and selected interval %s', (classificationZ) => {
    const config = createAdaptivePracticeQuizDefaultConfig()
    expect(config.totalQuestionCap).toBe('50')
    expect(
      serializeAdaptivePracticeQuizConfig({
        ...config,
        competenceTreeId: 'tree-id',
        classificationZ,
      })
    ).toMatchObject({
      totalQuestionCap: 50,
      classificationZ: Number(classificationZ),
    })
  })

  test('serializes optional duration in seconds and preserves explicit unlimited time', () => {
    const config = {
      ...createAdaptivePracticeQuizDefaultConfig(),
      competenceTreeId: 'tree-id',
    }
    expect(
      serializeAdaptivePracticeQuizConfig({ ...config, timeLimitMinutes: '90' })
        ?.timeLimitSeconds
    ).toBe(5400)
    expect(
      serializeAdaptivePracticeQuizConfig({ ...config, timeLimitMinutes: '' })
        ?.timeLimitSeconds
    ).toBeNull()
    expect(
      serializeAdaptivePracticeQuizConfig({
        ...config,
        timeLimitMinutes: '0.5',
      })?.timeLimitSeconds
    ).toBe(30)
  })

  test('requires an explicit scale for Placement pilot', () => {
    expect(
      isManageAdaptivePresetSelectable(AdaptivePracticeQuizPreset.Diagnostic)
    ).toBe(true)
    expect(
      isManageAdaptivePresetSelectable(AdaptivePracticeQuizPreset.Research)
    ).toBe(true)
    expect(
      isManageAdaptivePresetSelectable(AdaptivePracticeQuizPreset.Placement)
    ).toBe(false)
    expect(
      isManageAdaptivePresetSelectable(
        AdaptivePracticeQuizPreset.Placement,
        'scale-id'
      )
    ).toBe(true)
  })

  test('preserves the tree question limit and never submits a model probability as a Z interval', () => {
    const config = applyPlacementPilotDefaults({
      ...createAdaptivePracticeQuizDefaultConfig(),
      competenceTreeId: 'tree-id',
      scaleVersionId: 'scale-id',
      totalQuestionCap: '70',
    })
    expect(serializeAdaptivePracticeQuizConfig(config)).toMatchObject({
      preset: AdaptivePracticeQuizPreset.Placement,
      totalQuestionCap: 70,
      minQuestionsPerLeaf: 4,
      classificationZ: undefined,
    })
    expect(getAdaptivePracticeQuizEffectiveSettings(config)).toMatchObject({
      levelMappingRule: 'NEAREST',
      attemptSelectionPolicy: 'LATEST_COMPLETED',
    })
    expect(
      getAdaptivePracticeQuizEffectiveSettings({
        ...config,
        scaleVersionId: undefined,
      })
    ).toMatchObject({
      levelMappingRule: 'MASTERY',
      attemptSelectionPolicy: 'FIRST_COMPLETED',
    })
  })

  test('does not submit raw discrimination overrides from Research authoring', () => {
    const config = createAdaptivePracticeQuizDefaultConfig()
    const serialized = serializeAdaptivePracticeQuizConfig({
      ...config,
      competenceTreeId: 'tree-id',
      preset: AdaptivePracticeQuizPreset.Research,
      defaultDiscrimination: '8.5',
      elementOverrides: [
        { assignmentId: 12, enabled: true, discrimination: '9.5' },
      ],
    })

    expect(serialized).toMatchObject({
      competenceTreeId: 'tree-id',
      preset: AdaptivePracticeQuizPreset.Research,
      researchSettings: { defaultDiscrimination: undefined },
      elementOverrides: [
        { assignmentId: 12, enabled: true, discrimination: undefined },
      ],
    })
  })

  test('selects v2 with an immutable scale and omits legacy policy controls', () => {
    const config = createAdaptivePracticeQuizDefaultConfig()
    const serialized = serializeAdaptivePracticeQuizConfig({
      ...config,
      competenceTreeId: 'tree-id',
      scaleVersionId: 'scale-id',
      preset: AdaptivePracticeQuizPreset.Research,
      classificationZ: '4.5',
    })

    expect(serialized).toMatchObject({
      competenceTreeId: 'tree-id',
      scaleVersionId: 'scale-id',
      preset: AdaptivePracticeQuizPreset.Research,
      classificationZ: undefined,
      researchSettings: {
        attemptSelectionPolicy: 'LATEST_COMPLETED',
        defaultDiscrimination: undefined,
      },
    })
  })

  test('retains adaptive mode defaults without exposing psychometric controls', () => {
    const config = createAdaptivePracticeQuizDefaultConfig()

    expect(config.preset).toBe(AdaptivePracticeQuizPreset.Diagnostic)
    expect(PracticeQuizMode.Adaptive).toBe('ADAPTIVE')
  })
})
