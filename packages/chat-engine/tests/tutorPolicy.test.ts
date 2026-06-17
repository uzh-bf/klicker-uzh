import { describe, expect, it } from 'vitest'
import {
  TUTOR_WORKING_MEMORY_TEMPLATE,
  buildTutorMastraMemoryRuntime,
} from '../src/tutor/mastraMemory.js'
import {
  composeTutorMemoryInstructionsSuffix,
  evaluateTutorMemoryGate,
} from '../src/tutor/memoryGate.js'
import { buildTutorObservabilityAttributes } from '../src/tutor/observability.js'
import {
  selectTutorMovePolicy,
  type TutorPolicyState,
} from '../src/tutor/policy.js'
import { composeTutorInstructionsSuffix } from '../src/tutor/prompt.js'
import {
  extractEvidenceIdsFromToolPayload,
  runTutorVerifierPreflight,
  verifyTutorOutputText,
} from '../src/tutor/verifier.js'
import {
  TUTOR_TURN_WORKFLOW_STEPS,
  TutorWorkflowOutputSchema,
  tutorTurnWorkflow,
} from '../src/tutor/workflow.js'

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

  it('extracts evidence ids from nested tool payloads for citation fidelity', () => {
    const ids = extractEvidenceIdsFromToolPayload({
      toolResult: {
        chunks: [
          { chunk_id: 'chunk-wacc-1', text: 'Weighted cost of capital.' },
          'see source-financewiki-wacc for details',
        ],
      },
    })

    expect(ids).toEqual(['chunk-wacc-1', 'source-financewiki-wacc'])
    expect(
      verifyTutorOutputText({
        state: { ...baseState, retrievalNeeded: true },
        text: '**References**\n- Financewiki',
        retrievedEvidenceIds: ids,
      }).passed
    ).toBe(true)
  })

  it('blocks persistent memory when privacy requirements are incomplete', () => {
    const decision = evaluateTutorMemoryGate({
      enabled: true,
      privacyApproved: false,
      deletionSupported: true,
      studentTransparencyEnabled: false,
      embeddingEndpointApproved: true,
    })

    expect(decision.status).toBe('blocked')
    expect(decision.missingRequirements).toEqual([
      'privacy_approval',
      'student_view_delete_ui',
    ])
    expect(composeTutorMemoryInstructionsSuffix(decision)).toContain(
      'Persistent learner memory is blocked.'
    )
  })

  it('keeps Mastra memory inactive unless the privacy gate is enabled', () => {
    const decision = evaluateTutorMemoryGate({
      enabled: false,
      privacyApproved: false,
      deletionSupported: false,
      studentTransparencyEnabled: false,
      embeddingEndpointApproved: false,
    })
    const runtime = buildTutorMastraMemoryRuntime({
      decision,
      participantId: 'participant-1',
      chatbotId: 'chatbot-1',
      courseId: 'course-1',
      threadId: 'thread-1',
      connectionString: 'postgresql://example',
    })

    expect(runtime.status).toBe('inactive')
    expect(TUTOR_WORKING_MEMORY_TEMPLATE).toContain('# Course Learner State')
  })

  it('declares the Mastra tutor workflow stages in order', () => {
    expect(tutorTurnWorkflow.id).toBe('tutor-turn-workflow')
    expect(TUTOR_TURN_WORKFLOW_STEPS).toEqual([
      'collect_context',
      'retrieve_evidence',
      'select_move',
      'verify_candidate',
      'persist_and_log',
    ])
    expect(
      TutorWorkflowOutputSchema.safeParse({
        requestId: 'req',
        chatbotId: 'chatbot',
        courseId: 'course',
        participantId: 'participant',
        selectedMode: 'tutor-skills-v1',
        messageCount: 2,
        retrievalNeeded: true,
        retrievedEvidenceIds: ['chunk-wacc-1'],
        tutorState: {
          skillPackVersion: 'tutor-skills-v1',
          studentState: 'partial',
          allowedMove: 'hint',
          hintDepth: 1,
          leakageAllowed: false,
          misconceptionLabel: 'wacc_book_value_weights',
        },
        verifierFailures: [],
        workflowStages: [...TUTOR_TURN_WORKFLOW_STEPS],
        retrievalStatus: 'evidence_present',
        moveDecision: {
          allowedMove: 'hint',
          hintDepth: 1,
          leakageAllowed: false,
        },
        verifierStatus: 'passed',
        eventTypes: ['tutor_state_planned'],
      }).success
    ).toBe(true)
  })

  it('builds stable tutor observability attributes', () => {
    const attrs = buildTutorObservabilityAttributes({
      chatbotId: 'chatbot-1',
      courseId: 'course-1',
      selectedMode: 'tutor-skills-v1',
      modelId: 'gpt-test',
      state: baseState,
      retrievedEvidenceIds: ['chunk-wacc-1'],
    })

    expect(attrs['tutor.move']).toBe('hint')
    expect(attrs['tutor.retrieved_evidence_count']).toBe(1)
    expect(attrs['tutor.memory_status']).toBe('disabled')
  })
})
