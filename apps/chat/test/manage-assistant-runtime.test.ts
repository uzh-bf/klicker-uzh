import { describe, expect, test } from 'vitest'
import {
  buildManageAssistantSystemPrompt,
  selectManageAssistantModel,
} from '../src/services/manageAssistantRuntime'

describe('Manage assistant runtime helpers', () => {
  test('builds a prompt that treats route context as non-authoritative', () => {
    const prompt = buildManageAssistantSystemPrompt({
      version: 1,
      source: 'manage',
      surface: 'question-pool',
      locale: 'en',
      route: {
        asPath: '/resources/catalog?token=secret',
        pathname: '/resources/catalog',
      },
      ids: {
        courseId: 'course-1',
      },
    })

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
    expect(prompt).not.toContain('secret')
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
})
