import { readFileSync } from 'node:fs'
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

// The chat app and the GraphQL backend each carry their own built-in chat model
// registry (both overridable through CHAT_MODEL_REGISTRY_JSON). The backend copy
// drives the lecturer-facing allow-list in manage, the chat copy drives what
// students actually get. When they drift, lecturers can allow-list models that
// never reach students. The chat side is the source of truth. Deployment
// registries come from the one .Values.chat.modelRegistry source in
// deploy/env-uzh-{stg,prd}/values.yaml and are parsed here through BOTH
// consumers to prove repository-declared parity.

type ParityModel = {
  id: string
  deploymentId: string
  name: string
  description: string
  fallback: boolean
  supportsReasoning: boolean
  usesResponsesApi: boolean
  supportedReasoningEfforts: string[]
  maxOutputTokens: number
  usageClass: 'BASE' | 'ADVANCED'
  cost: { input: number; output: number }
}

function fallbackIds(models: readonly ParityModel[]) {
  return models.filter((model) => model.fallback).map((model) => model.id)
}

function sharedModelValues(models: readonly ParityModel[]) {
  return models
    .map(
      ({
        id,
        deploymentId,
        name,
        description,
        fallback,
        supportsReasoning,
        usesResponsesApi,
        supportedReasoningEfforts,
        maxOutputTokens,
        usageClass,
        cost,
      }) => ({
        id,
        deploymentId,
        name,
        description,
        fallback,
        supportsReasoning,
        usesResponsesApi,
        supportedReasoningEfforts: [...supportedReasoningEfforts].sort(),
        maxOutputTokens,
        usageClass,
        cost,
      })
    )
    .sort((left, right) => left.id.localeCompare(right.id))
}

type RegistryIssue = { code: string; path: (string | number)[] }

function getRegistryIssues(
  parseRegistry: (value: unknown) => unknown,
  value: unknown
): RegistryIssue[] {
  try {
    parseRegistry(value)
  } catch (error) {
    const issues = (error as { issues?: unknown }).issues
    if (Array.isArray(issues)) return issues as RegistryIssue[]
  }
  return []
}

const chatModels: ParityModel[] = DEFAULT_MODEL_REGISTRY
const backendModels: ParityModel[] = DEFAULT_CHAT_MODEL_REGISTRY
const syntheticMultiBaseRegistry: ParityModel[] = [
  {
    id: 'auto',
    deploymentId: 'auto-router',
    name: 'Auto',
    description: '',
    fallback: false,
    supportsReasoning: false,
    usesResponsesApi: true,
    supportedReasoningEfforts: [],
    maxOutputTokens: 4096,
    usageClass: 'BASE',
    cost: { input: 1, output: 1 },
  },
  {
    id: 'gpt-6-luna',
    deploymentId: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    description: '',
    fallback: true,
    supportsReasoning: true,
    usesResponsesApi: true,
    supportedReasoningEfforts: ['low'],
    maxOutputTokens: 4096,
    usageClass: 'BASE',
    cost: { input: 1, output: 1 },
  },
  {
    id: 'another-base',
    deploymentId: 'another-base',
    name: 'Another Base',
    description: '',
    fallback: false,
    supportsReasoning: false,
    usesResponsesApi: false,
    supportedReasoningEfforts: [],
    maxOutputTokens: 4096,
    usageClass: 'BASE',
    cost: { input: 1, output: 1 },
  },
]

describe('default chat model registry parity', () => {
  test('both consumers expose matching model policies and values', () => {
    expect(sharedModelValues(backendModels)).toEqual(
      sharedModelValues(chatModels)
    )
    expect(fallbackIds(chatModels)).toContain('gpt-6-luna')
    expect(fallbackIds(backendModels)).toContain('gpt-6-luna')
  })

  test('the built-in participant fallback resolves in the local model gateway', () => {
    const gateway = parseYaml(
      readFileSync(
        new URL('../../../util/litellm/config.yaml', import.meta.url),
        'utf8'
      )
    ) as { model_list: { model_name: string }[] }
    const deployments = new Set(
      gateway.model_list.map((model) => model.model_name)
    )

    for (const models of [chatModels, backendModels]) {
      for (const model of models.filter((entry) => entry.fallback)) {
        expect(deployments.has(model.deploymentId)).toBe(true)
      }
    }
  })

  test('both consumers accept additional BASE models and BASE Auto', () => {
    for (const parseRegistry of [parseChatRegistry, parseBackendRegistry]) {
      expect(
        sharedModelValues(parseRegistry(syntheticMultiBaseRegistry))
      ).toEqual(sharedModelValues(syntheticMultiBaseRegistry))
    }
  })

  test('both consumers reject duplicate model ids', () => {
    const duplicateRegistry = [
      ...chatModels,
      { ...chatModels.find((model) => model.id === 'gpt-6-luna')! },
    ]

    expect(() => parseChatRegistry(duplicateRegistry)).toThrow(
      /Duplicate model id/
    )
    expect(() => parseBackendRegistry(duplicateRegistry)).toThrow(
      /Duplicate model id/
    )
  })

  test('both consumers reject invalid output-token caps', () => {
    const invalidRegistries = [
      chatModels.map(
        ({ maxOutputTokens: _maxOutputTokens, ...model }) => model
      ),
      chatModels.map((model) => ({ ...model, maxOutputTokens: 1.5 })),
      chatModels.map((model) => ({ ...model, maxOutputTokens: 4097 })),
    ]

    for (const invalidRegistry of invalidRegistries) {
      expect(() => parseChatRegistry(invalidRegistry)).toThrow()
      expect(() => parseBackendRegistry(invalidRegistry)).toThrow()
    }
  })

  test('both consumers require GPT-6 Luna to be a BASE fallback', () => {
    const missingLunaRegistry = syntheticMultiBaseRegistry
      .filter((model) => model.id !== 'gpt-6-luna')
      .map((model) =>
        model.id === 'another-base' ? { ...model, fallback: true } : model
      )
    const nonBaseLunaRegistry = syntheticMultiBaseRegistry.map((model) =>
      model.id === 'gpt-6-luna'
        ? { ...model, usageClass: 'ADVANCED' as const }
        : model
    )
    const nonFallbackLunaRegistry = syntheticMultiBaseRegistry.map((model) =>
      model.id === 'gpt-6-luna'
        ? { ...model, fallback: false }
        : model.id === 'another-base'
          ? { ...model, fallback: true }
          : model
    )

    for (const parseRegistry of [parseChatRegistry, parseBackendRegistry]) {
      expect(
        getRegistryIssues(parseRegistry, missingLunaRegistry)
      ).toContainEqual(expect.objectContaining({ code: 'custom', path: [] }))
      expect(
        getRegistryIssues(parseRegistry, nonBaseLunaRegistry)
      ).toContainEqual(expect.objectContaining({ code: 'custom', path: [] }))
      expect(
        getRegistryIssues(parseRegistry, nonFallbackLunaRegistry)
      ).toContainEqual(
        expect.objectContaining({ code: 'custom', path: [1, 'fallback'] })
      )
    }
  })

  test('both consumers reject invalid Auto registry policy', () => {
    const withoutAuto = syntheticMultiBaseRegistry.filter(
      (model) => model.id !== 'auto'
    )
    const duplicateAuto = [
      ...syntheticMultiBaseRegistry,
      { ...syntheticMultiBaseRegistry.find((model) => model.id === 'auto')! },
    ]
    const autoFallback = syntheticMultiBaseRegistry.map((model) =>
      model.id === 'auto' ? { ...model, fallback: true } : model
    )
    const autoReasoning = syntheticMultiBaseRegistry.map((model) =>
      model.id === 'auto'
        ? {
            ...model,
            supportsReasoning: true,
            supportedReasoningEfforts: ['low'],
          }
        : model
    )

    for (const parseRegistry of [parseChatRegistry, parseBackendRegistry]) {
      expect(getRegistryIssues(parseRegistry, withoutAuto)).toContainEqual(
        expect.objectContaining({ code: 'custom', path: [] })
      )
      expect(getRegistryIssues(parseRegistry, duplicateAuto)).toContainEqual(
        expect.objectContaining({ code: 'custom', path: [] })
      )
      expect(getRegistryIssues(parseRegistry, autoFallback)).toContainEqual(
        expect.objectContaining({ code: 'custom', path: [0, 'fallback'] })
      )
      expect(getRegistryIssues(parseRegistry, autoReasoning)).toContainEqual(
        expect.objectContaining({
          code: 'custom',
          path: [0, 'supportsReasoning'],
        })
      )
    }
  })
})

function loadDeployedRegistries() {
  const valuesFiles = [
    {
      name: 'env-uzh-stg',
      url: new URL('../../../deploy/env-uzh-stg/values.yaml', import.meta.url),
    },
    {
      name: 'env-uzh-prd',
      url: new URL('../../../deploy/env-uzh-prd/values.yaml', import.meta.url),
    },
  ]

  return valuesFiles.map(({ name, url }) => {
    const parsed = parseYaml(readFileSync(url, 'utf8')) as {
      chat?: { modelRegistry?: unknown[] }
    }
    const entries = parsed.chat?.modelRegistry ?? []
    return {
      name,
      raw: entries,
      chat: parseChatRegistry(entries),
      backend: parseBackendRegistry(entries),
    }
  })
}

describe('deployed chat model registry parity (values.yaml)', () => {
  const deployed = loadDeployedRegistries()

  test('loads both deployment registries', () => {
    expect(deployed).toHaveLength(2)
    for (const { chat, backend } of deployed) {
      expect(chat.length).toBeGreaterThan(0)
      expect(backend.length).toBeGreaterThan(0)
    }
  })

  for (const { name, raw, chat, backend } of deployed) {
    test(`${name}: every entry declares an explicit usage class`, () => {
      for (const [index, entry] of raw.entries()) {
        const usageClass = (entry as { usageClass?: unknown } | null)
          ?.usageClass
        expect(
          usageClass,
          `${name} modelRegistry[${index}] must declare an explicit usageClass`
        ).toMatch(/^(BASE|ADVANCED)$/)
      }
    })

    test(`${name}: both consumers parse the same structured policy and values`, () => {
      expect(sharedModelValues(backend)).toEqual(sharedModelValues(chat))
      expect(fallbackIds(chat)).toContain('gpt-6-luna')
    })
  }

  test('staging and production expose the same accounting policy', () => {
    const [staging, production] = deployed
    expect(staging).toBeDefined()
    expect(production).toBeDefined()

    expect(sharedModelValues(staging!.chat)).toEqual(
      sharedModelValues(production!.chat)
    )
  })
})
