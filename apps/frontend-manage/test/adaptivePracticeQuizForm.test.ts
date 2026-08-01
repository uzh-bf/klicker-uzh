import {
  AdaptivePracticeQuizPreset,
  PracticeQuizMode,
} from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, test } from 'vitest'
import {
  createAdaptivePracticeQuizDefaultConfig,
  isManageAdaptivePresetSelectable,
  serializeAdaptivePracticeQuizConfig,
} from '../src/components/activities/creation/practiceQuiz/adaptivePracticeQuizForm'

describe('adaptive practice quiz Manage form', () => {
  test('keeps Placement unavailable to authors', () => {
    expect(
      isManageAdaptivePresetSelectable(AdaptivePracticeQuizPreset.Diagnostic)
    ).toBe(true)
    expect(
      isManageAdaptivePresetSelectable(AdaptivePracticeQuizPreset.Research)
    ).toBe(true)
    expect(
      isManageAdaptivePresetSelectable(AdaptivePracticeQuizPreset.Placement)
    ).toBe(false)
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
