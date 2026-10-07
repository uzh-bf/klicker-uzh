import { readFileSync } from 'node:fs'
import { resolveChatModelPolicy } from '@klicker-uzh/util'
import { describe, expect, test } from 'vitest'
import { parse as parseYaml } from 'yaml'
import {
  DEFAULT_CHAT_MODEL_REGISTRY,
  parseChatModelRegistry as parseBackendRegistry,
} from '../../../packages/graphql/src/services/chatbots'
import {
  DEFAULT_MODEL_REGISTRY,
  parseChatModelRegistry as parseChatRegistry,
} from '../src/lib/server/chatModelRegistry'

// Both consumers must expose the same capabilities and accounting policy for
// each environment. Environments may deliberately use different catalogs.
function expectParity(raw: unknown) {
  const chat = parseChatRegistry(raw)
  const backend = parseBackendRegistry(raw)
  expect(backend).toEqual(
    chat.map(({ supportsImageAttachments: _, ...model }) => model)
  )
  for (const model of chat) {
    expect(Number.isInteger(model.maxOutputTokens)).toBe(true)
    expect(model.maxOutputTokens).toBeGreaterThanOrEqual(1)
    expect(model.maxOutputTokens).toBeLessThanOrEqual(4096)
  }
  return { chat, backend }
}

function syntheticModel(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    deploymentId: `${id}-deployment`,
    name: id,
    fallback: false,
    supportsReasoning: false,
    maxOutputTokens: 2048,
    usageClass: 'ADVANCED',
    cost: { input: 0.2, output: 0.8 },
    ...overrides,
  }
}

const syntheticRegistry = [
  syntheticModel('auto', { usesResponsesApi: true }),
  syntheticModel('base-a', {
    fallback: true,
    usageClass: 'BASE',
    maxOutputTokens: 1024,
  }),
  syntheticModel('advanced-a', {
    supportsReasoning: true,
    supportedReasoningEfforts: ['low', 'high'],
  }),
]

describe('chat model consumer parity', () => {
  test('built-in registries have identical structured contracts', () => {
    expectParity(DEFAULT_MODEL_REGISTRY)
    expect(
      DEFAULT_CHAT_MODEL_REGISTRY.map(({ apiVersion: _, ...model }) => model)
    ).toEqual(
      DEFAULT_MODEL_REGISTRY.map(
        ({ supportsImageAttachments: _, apiVersion: _apiVersion, ...model }) =>
          model
      )
    )
  })

  test('both consumers preserve configured IDs, capabilities, costs and individual caps', () => {
    const { chat, backend } = expectParity(syntheticRegistry)
    expect(chat.map((model) => model.maxOutputTokens)).toEqual([
      2048, 1024, 2048,
    ])
    const options = {
      primaryModelId: 'advanced-a',
      fallbackModelId: 'base-a',
      newChatbotModelPolicyJson: JSON.stringify({
        modelSelection: true,
        allowedModelIds: ['auto', 'base-a'],
      }),
    }
    expect(resolveChatModelPolicy(chat, options)).toEqual(
      resolveChatModelPolicy(backend, options)
    )
    expect(resolveChatModelPolicy(chat, options)).toEqual({
      primaryModelId: 'advanced-a',
      fallbackModelId: 'base-a',
      newChatbotModelPolicy: {
        modelSelection: true,
        allowedModelIds: ['auto', 'base-a'],
      },
    })
  })

  test('both consumers reject duplicate IDs, invalid caps and unsafe BASE policy', () => {
    const invalid = [
      [...syntheticRegistry, syntheticRegistry[0]],
      ...[undefined, 0, 1.5, 4097].map((maxOutputTokens) =>
        syntheticRegistry.map((model) => ({ ...model, maxOutputTokens }))
      ),
      syntheticRegistry.map((model) => ({ ...model, usageClass: 'ADVANCED' })),
      syntheticRegistry.map((model) => ({ ...model, fallback: false })),
    ]
    for (const parse of [parseChatRegistry, parseBackendRegistry]) {
      for (const registry of invalid) expect(() => parse(registry)).toThrow()
    }
  })

  test('both consumers retain canonical Auto invariants', () => {
    for (const parse of [parseChatRegistry, parseBackendRegistry]) {
      expect(() =>
        parse(syntheticRegistry.filter((model) => model.id !== 'auto'))
      ).toThrow()
      expect(() =>
        parse(
          syntheticRegistry.map((model) =>
            model.id === 'auto' ? { ...model, fallback: true } : model
          )
        )
      ).toThrow()
      expect(() =>
        parse(
          syntheticRegistry.map((model) =>
            model.id === 'auto'
              ? {
                  ...model,
                  supportsReasoning: true,
                  supportedReasoningEfforts: ['low'],
                }
              : model
          )
        )
      ).toThrow()
    }
  })

  for (const environment of ['stg', 'prd']) {
    test(`${environment}: registry and effective policy are valid for both consumers`, () => {
      const values = parseYaml(
        readFileSync(
          new URL(
            `../../../deploy/env-uzh-${environment}/values.yaml`,
            import.meta.url
          ),
          'utf8'
        )
      )
      const { chat, backend } = expectParity(values.chat.modelRegistry)
      const options = {
        primaryModelId: values.chat.automaticModels?.primaryId,
        fallbackModelId: values.chat.automaticModels?.fallbackId,
        newChatbotModelPolicyJson: values.chat.newChatbotModelPolicy
          ? JSON.stringify(values.chat.newChatbotModelPolicy)
          : undefined,
      }
      expect(resolveChatModelPolicy(chat, options)).toEqual(
        resolveChatModelPolicy(backend, options)
      )
      for (const model of values.chat.modelRegistry) {
        expect(['BASE', 'ADVANCED']).toContain(model.usageClass)
      }
    })
  }
})
