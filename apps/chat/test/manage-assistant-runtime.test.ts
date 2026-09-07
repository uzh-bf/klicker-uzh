import { describe, expect, test } from 'vitest'
import {
  buildManageAssistantSystemPrompt,
  getManageAssistantOpenAIProviderOptions,
  selectManageAssistantModel,
} from '@/src/services/manageAssistantRuntime'
import type { ManageElementCreateProposal } from '@/src/services/manageProposals'

const SAMPLE_CONTEXT = {
  version: 1 as const,
  source: 'manage' as const,
  surface: 'question-pool' as const,
  locale: 'en',
  route: {
    asPath: '/resources/catalog?token=secret',
    pathname: '/resources/catalog',
  },
  ids: {
    courseId: 'course-1',
  },
}

describe('Manage assistant runtime helpers', () => {
  test('includes supplied route identifiers without copying sensitive query values', () => {
    const prompt = buildManageAssistantSystemPrompt(SAMPLE_CONTEXT)

    expect(prompt).toContain(SAMPLE_CONTEXT.ids.courseId)
    expect(prompt).toContain(SAMPLE_CONTEXT.route.pathname)
    expect(prompt).not.toContain('secret')
  })

  test('includes the injection-defense section referencing the actual sentinel when tools are available', () => {
    const sentinel = 'sentinel-abc-123'
    const prompt = buildManageAssistantSystemPrompt(
      SAMPLE_CONTEXT,
      true,
      true,
      sentinel
    )

    expect(prompt).toContain(`KLICKER_TOOL_DATA ${sentinel}`)
  })

  test('omits the injection-defense section when no sentinel is provided', () => {
    const prompt = buildManageAssistantSystemPrompt(SAMPLE_CONTEXT, true, true)

    expect(prompt).not.toContain('KLICKER_TOOL_DATA')
  })

  test('keeps the injection-defense section with a sentinel when lecturer MCP tools are unavailable', () => {
    const sentinel = 'sentinel-unused'
    const prompt = buildManageAssistantSystemPrompt(
      SAMPLE_CONTEXT,
      false,
      true,
      sentinel
    )

    // The Chat-local docs search tool is available on every request and its
    // results are fenced, so the fence rule must stay in the prompt even
    // when the lecturer MCP tools are unavailable.
    expect(prompt).toContain(`KLICKER_TOOL_DATA ${sentinel}`)
  })

  test('adds canonical signed proposal context for conversational revisions', () => {
    const previousProposal = {
      kind: 'element.create.proposal',
      payload: {
        basePoints: true,
        content: 'Which process converts grape sugar into ethanol?',
        explanation: 'The expected process is alcoholic fermentation.',
        name: 'Wine fermentation',
        options: {
          choices: [
            {
              correct: true,
              feedback: 'Correct.',
              value: 'Alcoholic fermentation',
            },
            {
              correct: false,
              feedback: 'This happens after alcoholic fermentation.',
              value: 'Malolactic fermentation',
            },
          ],
          displayMode: 'LIST',
          hasAnswerFeedbacks: true,
          hasSampleSolution: true,
        },
        pointsMultiplier: 1,
        status: 'DRAFT',
        tags: ['wine'],
        type: 'SC',
      },
      requiresConfirmation: true,
      summary: 'Create a wine question',
    } satisfies ManageElementCreateProposal

    const prompt = buildManageAssistantSystemPrompt(
      SAMPLE_CONTEXT,
      true,
      true,
      'sentinel',
      previousProposal
    )

    expect(prompt).toContain(previousProposal.payload.content)
    expect(prompt).toContain(
      previousProposal.payload.options.choices[1].feedback
    )
    expect(prompt).not.toContain(previousProposal.summary)
  })

  test('the injection-defense section coexists with both the draft and read-only tool-availability variants', () => {
    const sentinel = 'sentinel-variant-check'
    const draftPrompt = buildManageAssistantSystemPrompt(
      SAMPLE_CONTEXT,
      true,
      true,
      sentinel
    )
    const readOnlyPrompt = buildManageAssistantSystemPrompt(
      SAMPLE_CONTEXT,
      true,
      false,
      sentinel
    )

    expect(draftPrompt).toContain(`KLICKER_TOOL_DATA ${sentinel}`)

    expect(readOnlyPrompt).toContain(`KLICKER_TOOL_DATA ${sentinel}`)
  })

  test('selects the first primary model and falls back when needed', () => {
    expect(
      selectManageAssistantModel([
        {
          id: 'fallback',
          deploymentId: 'fallback-deployment',
          name: 'Fallback',
          description: '',
          fallback: true,
          supportsReasoning: false,
          usesResponsesApi: false,
          supportsImageAttachments: false,
          supportedReasoningEfforts: [],
          maxOutputTokens: 2048,
          usageClass: 'BASE',
          cost: { input: 0, output: 0 },
        },
        {
          id: 'primary',
          deploymentId: 'primary-deployment',
          name: 'Primary',
          description: '',
          fallback: false,
          supportsReasoning: false,
          usesResponsesApi: false,
          supportsImageAttachments: false,
          supportedReasoningEfforts: [],
          maxOutputTokens: 2048,
          usageClass: 'ADVANCED',
          cost: { input: 0, output: 0 },
        },
      ]).deploymentId
    ).toBe('primary-deployment')

    expect(
      selectManageAssistantModel([
        {
          id: 'fallback',
          deploymentId: 'fallback-deployment',
          name: 'Fallback',
          description: '',
          fallback: true,
          supportsReasoning: false,
          usesResponsesApi: false,
          supportsImageAttachments: false,
          supportedReasoningEfforts: [],
          maxOutputTokens: 2048,
          usageClass: 'BASE',
          cost: { input: 0, output: 0 },
        },
      ]).deploymentId
    ).toBe('fallback-deployment')
  })

  test('defaults Manage assistant responses to stateless (OpenRouter-safe) when unset', () => {
    const previousValue = process.env.CHAT_OPENAI_STORE_RESPONSES
    delete process.env.CHAT_OPENAI_STORE_RESPONSES

    try {
      expect(getManageAssistantOpenAIProviderOptions()).toEqual({
        store: false,
      })
    } finally {
      if (previousValue === undefined) {
        delete process.env.CHAT_OPENAI_STORE_RESPONSES
      } else {
        process.env.CHAT_OPENAI_STORE_RESPONSES = previousValue
      }
    }
  })

  test('reuses the sibling chatbot route env flag to enable response storage', () => {
    const previousValue = process.env.CHAT_OPENAI_STORE_RESPONSES
    process.env.CHAT_OPENAI_STORE_RESPONSES = 'true'

    try {
      expect(getManageAssistantOpenAIProviderOptions()).toEqual({
        store: true,
      })
    } finally {
      if (previousValue === undefined) {
        delete process.env.CHAT_OPENAI_STORE_RESPONSES
      } else {
        process.env.CHAT_OPENAI_STORE_RESPONSES = previousValue
      }
    }
  })
})
