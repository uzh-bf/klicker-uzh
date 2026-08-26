import { describe, expect, test } from 'vitest'
import { isGroundingDisclaimer } from '../src/components/personal-elements/candidatePresentation'

describe('generated card presentation', () => {
  test('filters the confirmed grounding disclaimer in English and German', () => {
    expect(
      isGroundingDisclaimer(
        'Die Flashcard verwendet ausschließlich die Informationen aus dem bereitgestellten Chunk.'
      )
    ).toBe(true)
    expect(
      isGroundingDisclaimer(
        'The flashcard uses only the information from the provided chunk.'
      )
    ).toBe(true)
    expect(
      isGroundingDisclaimer(
        'Die Flashcard verwendet ausschliesslich die Informationen aus dem bereitgestellten Chunk.'
      )
    ).toBe(true)
  })

  test('preserves substantive and near-match explanations', () => {
    expect(
      isGroundingDisclaimer('The flashcard explains the CAPM formula.')
    ).toBe(false)
    expect(
      isGroundingDisclaimer(
        'Die Flashcard verwendet die Informationen aus dem bereitgestellten Chunk.'
      )
    ).toBe(false)
    expect(
      isGroundingDisclaimer('This card uses only the supplied evidence.')
    ).toBe(true)
  })
})
