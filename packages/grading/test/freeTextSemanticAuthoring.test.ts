import {
  createSemanticFreeTextConfig,
  getSemanticFreeTextAdvancedMetadata,
  validateSemanticFreeTextConfig,
} from '../src/freeTextSemanticEvaluation.js'

describe('semantic free-text authoring helpers', () => {
  it('upgrades legacy solutions without conflating exact and reference answers', () => {
    const config = createSemanticFreeTextConfig({
      language: 'en',
      legacySolutions: ['First answer', 'Alternative answer'],
    })

    expect(config.accepted_exact_answers).toEqual([
      'First answer',
      'Alternative answer',
    ])
    expect(config.reference_solution).toBe('')
    expect(config.attempt_limit).toBe(2)
    expect(config.solution_reveal_enabled).toBe(true)
    expect(validateSemanticFreeTextConfig(config)).toContain(
      'reference_solution is required when solution reveal is enabled'
    )
  })

  it('uses the question language for default rubric and outcome copy', () => {
    const config = createSemanticFreeTextConfig({
      language: 'de',
      legacySolutions: ['Eine Referenzlösung'],
    })

    expect(config.rubric_schema.name).toBe('Freitext-Bewertung')
    expect(
      Object.fromEntries(
        config.outcome_bands?.map((band) => [band.category, band.label]) ?? []
      )
    ).toEqual({
      INCORRECT: 'Nicht korrekt',
      PARTIAL: 'Teilweise korrekt',
      CORRECT: 'Korrekt',
    })
    config.reference_solution = 'Eine vollständige Referenzlösung'
    expect(validateSemanticFreeTextConfig(config)).toEqual([])
  })

  it('extracts advanced schema fields without mutating or dropping them', () => {
    const config = createSemanticFreeTextConfig({
      language: 'en',
      legacySolutions: ['Reference answer'],
    })
    config.rubric_schema.evidence_contract = { mode: 'strict' }
    config.rubric_schema.rubrics[0]!.anchors = { excellent: 'Example' }
    config.rubric_schema.rubrics[0]!.achievement_levels[0]!.modalities = [
      'text',
    ]

    expect(getSemanticFreeTextAdvancedMetadata(config.rubric_schema)).toEqual({
      schema: { evidence_contract: { mode: 'strict' } },
      rubrics: [
        {
          rubric: 'content-quality',
          metadata: { anchors: { excellent: 'Example' } },
          achievement_levels: [
            { level: 'not met', metadata: { modalities: ['text'] } },
          ],
        },
      ],
    })
    expect(config.rubric_schema.evidence_contract).toEqual({ mode: 'strict' })
    expect(config.rubric_schema.rubrics[0]!.anchors).toEqual({
      excellent: 'Example',
    })
  })
})
