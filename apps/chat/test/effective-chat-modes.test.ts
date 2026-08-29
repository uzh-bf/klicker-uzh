import { describe, expect, test } from 'vitest'
import {
  resolveEffectiveChatModeOptions,
  resolveEffectiveMCPConfigurations,
} from '../src/lib/server/effectiveChatModes'

function config({
  allowedTools,
  chatMode,
  isEnabled = true,
  parameters,
  priority = 0,
  serverId,
}: {
  allowedTools?: string[]
  chatMode: string
  isEnabled?: boolean
  parameters?: Record<string, unknown>
  priority?: number
  serverId: string
}) {
  return {
    allowedTools,
    chatMode,
    isEnabled,
    mcpServer: { id: serverId },
    parameters,
    priority,
  }
}

describe('effective chatbot modes', () => {
  test('composes platform and stored modes while preserving custom copy', () => {
    expect(
      resolveEffectiveChatModeOptions(
        {
          tutor: {
            prompt: 'Custom Tutor prompt',
            description: 'Custom Tutor description',
          },
          explainer: { description: 'Stored Explainer description' },
          custom: { description: 'Custom mode description' },
        },
        []
      )
    ).toEqual({
      tutor: 'Acts as a patient and knowledgeable tutor.',
      explainer: 'Stored Explainer description',
      custom: 'Custom mode description',
    })
  })

  test('honours explicit mode opt-outs', () => {
    expect(
      resolveEffectiveChatModeOptions(
        {
          tutor: { enabled: false },
          custom: { description: 'Disabled', enabled: false },
        },
        []
      )
    ).toEqual({})
  })

  test('hides modes that cannot satisfy the chatbot required-tool policy', () => {
    const configurations = [
      config({
        allowedTools: ['course_search'],
        chatMode: 'tutor',
        parameters: { required: true, toolAlias: 'doc_query' },
        serverId: 'course',
      }),
    ]

    expect(
      resolveEffectiveChatModeOptions(
        {
          tutor: { description: 'Tutor' },
          explainer: { description: 'Explainer' },
          custom: { description: 'Custom' },
        },
        configurations
      )
    ).toEqual({
      tutor: 'Acts as a patient and knowledgeable tutor.',
    })
  })

  test('inherits only a restricted Tutor document-query binding', () => {
    const configurations = [
      config({
        allowedTools: ['doc_query', 'course_outline'],
        chatMode: 'tutor',
        priority: 2,
        serverId: 'course',
      }),
      config({
        allowedTools: ['*'],
        chatMode: 'tutor',
        serverId: 'unrestricted',
      }),
    ]

    expect(
      resolveEffectiveMCPConfigurations(configurations, 'quizzer')
    ).toEqual([
      expect.objectContaining({
        allowedTools: ['doc_query'],
        chatMode: 'quizzer',
        mcpServer: { id: 'course' },
        priority: 2,
      }),
    ])
    expect(
      resolveEffectiveChatModeOptions(
        { quizzer: { description: 'Quizzer' } },
        configurations
      )
    ).toHaveProperty('quizzer', 'Quizzer')
  })

  test('preserves a required aliased binding and its raw tool restriction', () => {
    const configurations = [
      config({
        allowedTools: ['course_video_expert'],
        chatMode: 'tutor',
        parameters: { required: true, toolAlias: 'doc_query' },
        serverId: 'course',
      }),
    ]

    expect(
      resolveEffectiveMCPConfigurations(configurations, 'quizzer')
    ).toEqual([
      expect.objectContaining({
        allowedTools: ['course_video_expert'],
        chatMode: 'quizzer',
        parameters: { required: true, toolAlias: 'doc_query' },
      }),
    ])
  })

  test('resolves exact Quizzer precedence per server', () => {
    const configurations = [
      config({
        allowedTools: ['doc_query'],
        chatMode: 'tutor',
        serverId: 'blocked',
      }),
      config({
        allowedTools: ['doc_query'],
        chatMode: 'quizzer',
        isEnabled: false,
        serverId: 'blocked',
      }),
      config({
        allowedTools: ['doc_query'],
        chatMode: 'tutor',
        priority: 1,
        serverId: 'inherited',
      }),
      config({
        allowedTools: ['supplemental'],
        chatMode: 'quizzer',
        priority: 2,
        serverId: 'supplemental',
      }),
    ]

    expect(
      resolveEffectiveMCPConfigurations(configurations, 'quizzer')
    ).toEqual([
      expect.objectContaining({
        allowedTools: ['doc_query'],
        mcpServer: { id: 'inherited' },
      }),
      expect.objectContaining({
        allowedTools: ['supplemental'],
        mcpServer: { id: 'supplemental' },
      }),
    ])
  })

  test('does not expose Quizzer without a safe document-query binding', () => {
    const configurations = [
      config({
        allowedTools: ['doc_*'],
        chatMode: 'tutor',
        serverId: 'wildcard',
      }),
    ]

    expect(
      resolveEffectiveChatModeOptions(
        { quizzer: { description: 'Quizzer' } },
        configurations
      )
    ).not.toHaveProperty('quizzer')
  })
})
