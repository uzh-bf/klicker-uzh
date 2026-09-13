import { describe, expect, it } from 'vitest'
import { schema } from '../src/index.js'

describe('participant data-use API', () => {
  it('exposes six current-state fields and keeps them out of Participant', () => {
    const dataUseType = schema.getType('ParticipantDataUse')
    expect(dataUseType).toBeDefined()
    if (!dataUseType) return
    const dataUseFields = Object.keys(
      (dataUseType as { getFields: () => Record<string, unknown> }).getFields()
    ).sort()
    expect(dataUseFields).toEqual([
      'learningAnalyticsChoiceAt',
      'learningAnalyticsConsent',
      'learningAnalyticsDisclosureVersion',
      'researchConsent',
      'researchConsentChoiceAt',
      'researchConsentDisclosureVersion',
    ])

    const participantType = schema.getType('Participant')
    expect(participantType).toBeDefined()
    if (!participantType) return
    const participantFields = (
      participantType as { getFields: () => Record<string, unknown> }
    ).getFields()
    for (const field of [
      'researchConsent',
      'researchConsentChoiceAt',
      'researchConsentDisclosureVersion',
      'learningAnalyticsConsent',
      'learningAnalyticsChoiceAt',
      'learningAnalyticsDisclosureVersion',
    ]) {
      expect(participantFields).not.toHaveProperty(field)
    }

    const queryField = schema.getQueryType()!.getFields().selfDataUse
    expect(queryField).toBeDefined()
    if (!queryField) return
    expect(queryField.type.toString()).toBe('ParticipantDataUse')
    expect(queryField.args).toHaveLength(0)
  })
})
