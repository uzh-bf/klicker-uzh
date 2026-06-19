import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

export const TUTOR_TURN_WORKFLOW_STEPS = [
  'collect_context',
  'retrieve_evidence',
  'select_move',
  'verify_candidate',
  'persist_and_log',
] as const

const TutorWorkflowInputSchema = z.object({
  requestId: z.string(),
  chatbotId: z.string(),
  courseId: z.string().nullable(),
  participantId: z.string().nullable(),
  selectedMode: z.string(),
  messageCount: z.number().int().min(0),
  retrievalNeeded: z.boolean(),
  retrievedEvidenceIds: z.array(z.string()),
  tutorState: z.object({
    skillPackVersion: z.string(),
    studentState: z.string(),
    allowedMove: z.string(),
    hintDepth: z.number().int().min(0),
    leakageAllowed: z.boolean(),
    misconceptionLabel: z.string().nullable(),
  }),
  verifierFailures: z.array(z.string()),
})

const ContextOutputSchema = TutorWorkflowInputSchema.extend({
  workflowStages: z.array(z.string()),
})

const RetrievalOutputSchema = ContextOutputSchema.extend({
  retrievalStatus: z.enum([
    'not_needed',
    'evidence_present',
    'evidence_missing',
  ]),
})
type RetrievalStatus = z.infer<typeof RetrievalOutputSchema>['retrievalStatus']

const MoveOutputSchema = RetrievalOutputSchema.extend({
  moveDecision: z.object({
    allowedMove: z.string(),
    hintDepth: z.number().int().min(0),
    leakageAllowed: z.boolean(),
  }),
})

const VerificationOutputSchema = MoveOutputSchema.extend({
  verifierStatus: z.enum(['passed', 'failed']),
})
type VerifierStatus = z.infer<typeof VerificationOutputSchema>['verifierStatus']

export const TutorWorkflowOutputSchema = VerificationOutputSchema.extend({
  eventTypes: z.array(z.string()),
})

const collectContextStep = createStep({
  id: TUTOR_TURN_WORKFLOW_STEPS[0],
  inputSchema: TutorWorkflowInputSchema,
  outputSchema: ContextOutputSchema,
  execute: async ({ inputData }) => ({
    ...inputData,
    workflowStages: [TUTOR_TURN_WORKFLOW_STEPS[0]],
  }),
})

const retrieveEvidenceStep = createStep({
  id: TUTOR_TURN_WORKFLOW_STEPS[1],
  inputSchema: ContextOutputSchema,
  outputSchema: RetrievalOutputSchema,
  execute: async ({ inputData }) => {
    const retrievalStatus: RetrievalStatus = !inputData.retrievalNeeded
      ? 'not_needed'
      : inputData.retrievedEvidenceIds.length > 0
        ? 'evidence_present'
        : 'evidence_missing'
    return {
      ...inputData,
      workflowStages: [
        ...inputData.workflowStages,
        TUTOR_TURN_WORKFLOW_STEPS[1],
      ],
      retrievalStatus,
    }
  },
})

const selectMoveStep = createStep({
  id: TUTOR_TURN_WORKFLOW_STEPS[2],
  inputSchema: RetrievalOutputSchema,
  outputSchema: MoveOutputSchema,
  execute: async ({ inputData }) => ({
    ...inputData,
    workflowStages: [...inputData.workflowStages, TUTOR_TURN_WORKFLOW_STEPS[2]],
    moveDecision: {
      allowedMove: inputData.tutorState.allowedMove,
      hintDepth: inputData.tutorState.hintDepth,
      leakageAllowed: inputData.tutorState.leakageAllowed,
    },
  }),
})

const verifyCandidateStep = createStep({
  id: TUTOR_TURN_WORKFLOW_STEPS[3],
  inputSchema: MoveOutputSchema,
  outputSchema: VerificationOutputSchema,
  execute: async ({ inputData }) => {
    const verifierStatus: VerifierStatus =
      inputData.verifierFailures.length > 0 ? 'failed' : 'passed'
    return {
      ...inputData,
      workflowStages: [
        ...inputData.workflowStages,
        TUTOR_TURN_WORKFLOW_STEPS[3],
      ],
      verifierStatus,
    }
  },
})

const persistAndLogStep = createStep({
  id: TUTOR_TURN_WORKFLOW_STEPS[4],
  inputSchema: VerificationOutputSchema,
  outputSchema: TutorWorkflowOutputSchema,
  execute: async ({ inputData }) => ({
    ...inputData,
    workflowStages: [...inputData.workflowStages, TUTOR_TURN_WORKFLOW_STEPS[4]],
    eventTypes: [
      'tutor_state_planned',
      'tutor_move_selected',
      'feedback_delivered',
      ...(inputData.verifierStatus === 'failed'
        ? ['citation_fidelity_failed']
        : []),
    ],
  }),
})

export const tutorTurnWorkflow = createWorkflow({
  id: 'tutor-turn-workflow',
  inputSchema: TutorWorkflowInputSchema,
  outputSchema: TutorWorkflowOutputSchema,
})
  .then(collectContextStep)
  .then(retrieveEvidenceStep)
  .then(selectMoveStep)
  .then(verifyCandidateStep)
  .then(persistAndLogStep)

tutorTurnWorkflow.commit()
