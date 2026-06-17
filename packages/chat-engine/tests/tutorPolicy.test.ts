import { describe, expect, it } from 'vitest'
import {
  selectTutorMovePolicy,
  type TutorPolicyState,
} from '../src/tutor/policy.js'
import { composeTutorInstructionsSuffix } from '../src/tutor/prompt.js'

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
})
