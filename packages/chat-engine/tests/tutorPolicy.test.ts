import { describe, expect, it } from 'vitest'
import {
  selectTutorMovePolicy,
  type TutorPolicyState,
} from '../src/tutor/policy.js'
import { composeTutorInstructionsSuffix } from '../src/tutor/prompt.js'
import {
  runTutorVerifierPreflight,
  verifyTutorOutputText,
} from '../src/tutor/verifier.js'

const baseState: TutorPolicyState = {
  skillPackVersion: 'tutor-skills-v1',
  studentState: 'stuck',
  hintDepth: 0,
  allowedMove: 'hint',
  leakageAllowed: false,
  retrievalNeeded: false,
}

describe('tutor move policy', () => {
  it('blocks final answers when leakage is not allowed', () => {
    const policy = selectTutorMovePolicy(baseState)

    expect(policy.allowedMove).toBe('hint')
    expect(policy.maxQuestions).toBe(1)
    expect(policy.directAnswerAllowed).toBe(false)
    expect(policy.directives.join('\n')).toContain(
      'Do not provide the final answer'
    )
  })

  it('requires image confirmation before tutoring when image uncertainty exists', () => {
    const suffix = composeTutorInstructionsSuffix({
      ...baseState,
      imageUncertainty: true,
    })

    expect(suffix).toContain('allowed_move: hint')
    expect(suffix).toContain(
      'Ask one clarification or confirmation about the uncertain image'
    )
    expect(suffix).toContain('Do not reveal private state')
  })

  it('allows only one worked micro-step when leakage is allowed', () => {
    const policy = selectTutorMovePolicy({
      ...baseState,
      allowedMove: 'worked_micro_step',
      leakageAllowed: true,
      retrievalNeeded: true,
    })

    expect(policy.directAnswerAllowed).toBe(true)
    expect(policy.citationRule).toBe('cite_retrieved_evidence_only')
    expect(policy.directives.join('\n')).toContain(
      'Work exactly one micro-step'
    )
  })

  it('adds leakage and citation preflight directives for high-risk turns', () => {
    const preflight = runTutorVerifierPreflight({
      state: { ...baseState, retrievalNeeded: true },
      latestUserMessage: 'Gib mir die Lösung.',
    })

    expect(preflight.risk).toBe('high')
    expect(preflight.failures).toContain('answer_leakage')
    expect(preflight.directives.join('\n')).toContain('Leakage gate')
    expect(preflight.directives.join('\n')).toContain('Citation gate')
  })

  it('flags too many questions and unsupported citations post-hoc', () => {
    const result = verifyTutorOutputText({
      state: baseState,
      text: 'Die Lösung ist 42. Was ist Schritt 1? Was ist Schritt 2?\n\n**References**\n- Financewiki',
    })

    expect(result.passed).toBe(false)
    expect(result.failures).toContain('answer_leakage')
    expect(result.failures).toContain('too_many_questions')
    expect(result.failures).toContain('unsupported_citation')
    expect(result.stats.questionCount).toBe(2)
  })
})
