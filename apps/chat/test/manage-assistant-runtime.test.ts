import {
  buildManageAssistantSystemPrompt,
  getManageAssistantOpenAIProviderOptions,
  selectManageAssistantModel,
} from '@/src/services/manageAssistantRuntime'
import { describe, expect, test } from 'vitest'

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
  test('builds a prompt that treats route context as non-authoritative', () => {
    const prompt = buildManageAssistantSystemPrompt(SAMPLE_CONTEXT)

    expect(prompt).toContain('Current KlickerUZH Manage context')
    expect(prompt).toContain('Course ID: course-1')
    expect(prompt).toContain('Manage assistant skills')
    expect(prompt).toContain('does not grant permissions')
    expect(prompt).toContain('Do not persist')
    expect(prompt).toContain('signed proposal card')
    expect(prompt).toContain('use the signed proposal tool')
    expect(prompt).toContain(
      'draft-only question, answer-choice, feedback, and signed proposal tools'
    )
    expect(prompt).toContain(
      'omit status and type filters unless the lecturer explicitly asks'
    )
    expect(prompt).toContain('Do not expose raw tool JSON or raw UUIDs')
    expect(prompt).not.toContain('secret')
  })

  test('hardens the prompt so persistence intents always call the signed proposal tool', () => {
    const prompt = buildManageAssistantSystemPrompt(SAMPLE_CONTEXT)

    // Persistence intent -> mandatory tool call, naming the exact tool.
    expect(prompt).toContain('is a persistence intent')
    expect(prompt).toContain(
      'create, make, save, store, persist, or add a question'
    )
    expect(prompt).toContain('klicker_lecturer_element_create_draft_proposal')
    expect(prompt).toContain('always use the signed proposal tool')

    // Never print proposal/question JSON as message text.
    expect(prompt).toContain(
      'never print a proposal or question as JSON in the chat message text'
    )

    // Draft-only scaffolding tools are brainstorming-only, prose output.
    expect(prompt).toContain(
      'Draft-only scaffolding tools are for brainstorming and non-persisted previews only'
    )
    expect(prompt).toContain('never as JSON')

    // Preserve the previously hardened post-tool reply constraint.
    expect(prompt).toContain('reply with at most one short sentence')
  })

  test('builds distinct prompts for the tools-available and tools-unavailable branches', () => {
    const toolsAvailablePrompt = buildManageAssistantSystemPrompt(
      SAMPLE_CONTEXT,
      true
    )
    const toolsUnavailablePrompt = buildManageAssistantSystemPrompt(
      SAMPLE_CONTEXT,
      false
    )

    // Shared, tools-agnostic invariants hold even without tools; the
    // tools-available branch is already covered by the tests above.
    expect(toolsUnavailablePrompt).toContain(
      'klicker_lecturer_element_create_draft_proposal'
    )
    expect(toolsUnavailablePrompt).toContain(
      'never print a proposal or question as JSON in the chat message text'
    )
    expect(toolsUnavailablePrompt).toContain(
      'Current KlickerUZH Manage context'
    )

    // Tools-available branch describes the available read/draft/proposal tools.
    expect(toolsAvailablePrompt).toContain(
      'Lecturer MCP read tools are available for authorized course and question-pool lookups'
    )
    expect(toolsAvailablePrompt).toContain(
      'draft-only question, answer-choice, feedback, and signed proposal tools are available for content scaffolding'
    )
    expect(toolsAvailablePrompt).not.toContain(
      'Lecturer MCP tools are currently unavailable'
    )

    // Tools-unavailable branch is transparent that live data cannot be queried.
    expect(toolsUnavailablePrompt).toContain(
      'Lecturer MCP tools are currently unavailable'
    )
    expect(toolsUnavailablePrompt).toContain(
      'Be transparent that live Klicker data cannot be queried in this response'
    )
    expect(toolsUnavailablePrompt).not.toContain(
      'Lecturer MCP read tools are available for authorized course and question-pool lookups'
    )
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
          supportsImageAttachments: false,
          supportedReasoningEfforts: [],
          cost: { input: 0, output: 0 },
        },
        {
          id: 'primary',
          deploymentId: 'primary-deployment',
          name: 'Primary',
          description: '',
          fallback: false,
          supportsReasoning: false,
          supportsImageAttachments: false,
          supportedReasoningEfforts: [],
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
          supportsImageAttachments: false,
          supportedReasoningEfforts: [],
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
