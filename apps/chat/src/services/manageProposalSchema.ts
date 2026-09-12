import { z } from 'zod'

// Client-safe proposal schema module: imported by the proposal preview inside
// the browser bundle, so it must not import server-only modules (the rest of
// manageProposals.ts pulls in @klicker-uzh/util and with it ioredis).

const proposalChoiceSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().trim().min(1).max(500).optional(),
  ix: z.number().int().min(0).optional(),
  value: z.string().trim().min(1).max(240),
})

const baseProposalPayloadSchema = z.object({
  basePoints: z.boolean().default(true),
  content: z.string().trim().min(1).max(4000),
  explanation: z.string().trim().min(1).max(2000).optional(),
  name: z.string().trim().min(1).max(160),
  pointsMultiplier: z.number().int().min(1).max(100).default(1),
  status: z.literal('DRAFT'),
  tags: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
})

export const choicesProposalPayloadSchema = baseProposalPayloadSchema.extend({
  options: z.object({
    choices: z.array(proposalChoiceSchema).min(2).max(8),
    displayMode: z.literal('LIST').default('LIST'),
    hasAnswerFeedbacks: z.boolean().default(false),
    hasSampleSolution: z.boolean().default(true),
  }),
  type: z.enum(['SC', 'MC']),
})

export const freeTextProposalPayloadSchema = baseProposalPayloadSchema.extend({
  options: z.object({
    hasSampleSolution: z.boolean().default(false),
    restrictions: z.object({
      maxLength: z.number().int().positive().optional(),
    }),
    solutions: z.array(z.string().trim().min(1).max(500)).optional(),
  }),
  type: z.literal('FREE_TEXT'),
})

export const manageElementCreateProposalSchema = z.object({
  kind: z.literal('element.create.proposal'),
  payload: z.union([
    choicesProposalPayloadSchema,
    freeTextProposalPayloadSchema,
  ]),
  requiresConfirmation: z.literal(true),
  summary: z.string().trim().min(1).max(240).optional(),
})

export type ManageElementCreateProposal = z.infer<
  typeof manageElementCreateProposalSchema
>
