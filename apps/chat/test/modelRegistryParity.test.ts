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
  fallback: boolean
  supportsReasoning: boolean
  usesResponsesApi: boolean
  supportedReasoningEfforts: string[]
  maxOutputTokens: number
  usageClass: 'BASE' | 'ADVANCED'
  cost: { input: number; output: number }
}

function byId(models: readonly ParityModel[]) {
  return new Map(models.map((model) => [model.id, model]))
}

function fallbackIds(models: readonly ParityModel[]) {
  return models.filter((model) => model.fallback).map((model) => model.id)
}

function baseModelIds(models: readonly ParityModel[]) {
  return models
    .filter((model) => model.usageClass === 'BASE')
    .map((model) => model.id)
}

function costsById(models: readonly ParityModel[]) {
  return Object.fromEntries(
    models.map((model) => [model.id, model.cost] as const)
  )
}

const expectedDefaultCosts = {
  auto: { input: 1, output: 5 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-5.4': { input: 2.5, output: 15 },
  'gpt-5.1': { input: 1.25, output: 10 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
}

const expectedDeployedCosts = {
  auto: { input: 1, output: 5 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-5.1': { input: 1.25, output: 10 },
  'gpt-5.4': { input: 2.5, output: 15 },
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
}

const chatModels: ParityModel[] = DEFAULT_MODEL_REGISTRY
const backendModels: ParityModel[] = DEFAULT_CHAT_MODEL_REGISTRY

describe('default chat model registry parity', () => {
  test('both registries expose the same model ids', () => {
    expect([...byId(backendModels).keys()].sort()).toEqual(
      [...byId(chatModels).keys()].sort()
    )
  })

  test('every model maps to the same deployment id', () => {
    const backendById = byId(backendModels)
    for (const model of chatModels) {
      expect(backendById.get(model.id)?.deploymentId).toBe(model.deploymentId)
    }
  })

  test('every model supports the same reasoning efforts', () => {
    const backendById = byId(backendModels)
    for (const model of chatModels) {
      expect(
        [...(backendById.get(model.id)?.supportedReasoningEfforts ?? [])]
          .sort()
          .join(',')
      ).toBe([...model.supportedReasoningEfforts].sort().join(','))
    }
  })

  test('every model uses the same OpenAI API adapter', () => {
    const backendById = byId(backendModels)
    for (const model of chatModels) {
      expect(backendById.get(model.id)?.supportsReasoning).toBe(
        model.supportsReasoning
      )
      expect(backendById.get(model.id)?.usesResponsesApi).toBe(
        model.usesResponsesApi
      )
    }
  })

  test('every model uses the bounded output-token ceiling', () => {
    for (const model of [...chatModels, ...backendModels]) {
      expect(model.maxOutputTokens).toBe(4096)
    }
  })

  test('both registries designate the same fallback model', () => {
    expect(fallbackIds(chatModels)).toHaveLength(1)
    expect(fallbackIds(backendModels)).toEqual(fallbackIds(chatModels))
    expect(fallbackIds(chatModels)).toEqual(['gpt-5.6-luna'])
  })

  test('every model carries the same explicit usage class in both copies', () => {
    const backendById = byId(backendModels)
    for (const model of chatModels) {
      expect(backendById.get(model.id)?.usageClass).toBe(model.usageClass)
    }
    expect(chatModels.find((m) => m.id === 'auto')?.usageClass).toBe('ADVANCED')
    expect(baseModelIds(chatModels)).toEqual(['gpt-5.6-luna'])
    expect(baseModelIds(backendModels)).toEqual(['gpt-5.6-luna'])
  })

  test('every model carries the same verified input and output cost', () => {
    expect(costsById(chatModels)).toEqual(expectedDefaultCosts)
    expect(costsById(backendModels)).toEqual(expectedDefaultCosts)
  })

  test('both consumers reject duplicate model ids', () => {
    const duplicateRegistry = [
      ...chatModels,
      { ...chatModels.find((model) => model.id === 'gpt-5.6-luna')! },
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

  test('both consumers reject invalid participant-credit base policy', () => {
    const soleNonLunaBaseRegistry = chatModels.map((model) => {
      if (model.id === 'gpt-5.6-luna') {
        return { ...model, usageClass: 'ADVANCED' as const }
      }
      if (model.id === 'gpt-4.1') {
        return { ...model, usageClass: 'BASE' as const }
      }
      return model
    })
    const nonFallbackLunaRegistry = chatModels.map((model) =>
      model.id === 'gpt-5.6-luna' ? { ...model, fallback: false } : model
    )

    for (const parseRegistry of [parseChatRegistry, parseBackendRegistry]) {
      expect(() => parseRegistry(soleNonLunaBaseRegistry)).toThrow(
        /gpt-5\.6-luna.*only BASE/
      )
      expect(() => parseRegistry(nonFallbackLunaRegistry)).toThrow(
        /participant-credit fallback/
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
        expect(
          (entry as { maxOutputTokens?: unknown } | null)?.maxOutputTokens,
          `${name} modelRegistry[${index}] must declare maxOutputTokens=4096`
        ).toBe(4096)
      }
    })

    test(`${name}: both consumers accept every entry and classify identically`, () => {
      const backendById = byId(backend)
      for (const model of chat) {
        const backendModel = backendById.get(model.id)
        expect(
          backendModel,
          `missing backend entry for ${model.id}`
        ).toBeDefined()
        expect(backendModel?.usageClass).toBe(model.usageClass)
        expect(backendModel?.fallback).toBe(model.fallback)
        expect(backendModel?.cost).toEqual(model.cost)
        expect(model.maxOutputTokens).toBe(4096)
        expect(backendModel?.maxOutputTokens).toBe(4096)
      }
      expect(chat.find((m) => m.id === 'auto')?.usageClass).toBe('ADVANCED')
      expect(baseModelIds(chat)).toEqual(['gpt-5.6-luna'])
      expect(fallbackIds(chat)).toEqual(['gpt-5.6-luna'])
      expect(costsById(chat)).toEqual(expectedDeployedCosts)
    })
  }

  test('staging and production expose the same accounting policy', () => {
    const [staging, production] = deployed
    expect(staging).toBeDefined()
    expect(production).toBeDefined()

    expect(
      staging!.chat.map(
        ({ id, usageClass, fallback, cost, maxOutputTokens }) => ({
          id,
          usageClass,
          fallback,
          cost,
          maxOutputTokens,
        })
      )
    ).toEqual(
      production!.chat.map(
        ({ id, usageClass, fallback, cost, maxOutputTokens }) => ({
          id,
          usageClass,
          fallback,
          cost,
          maxOutputTokens,
        })
      )
    )
  })
})
