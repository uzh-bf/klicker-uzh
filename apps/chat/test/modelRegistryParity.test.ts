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
  usageClass: 'BASE' | 'ADVANCED'
}

function byId(models: readonly ParityModel[]) {
  return new Map(models.map((model) => [model.id, model]))
}

function fallbackIds(models: readonly ParityModel[]) {
  return models.filter((model) => model.fallback).map((model) => model.id)
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

  test('both registries designate the same fallback model', () => {
    expect(fallbackIds(chatModels)).toHaveLength(1)
    expect(fallbackIds(backendModels)).toEqual(fallbackIds(chatModels))
  })

  test('every model carries the same explicit usage class in both copies', () => {
    const backendById = byId(backendModels)
    for (const model of chatModels) {
      expect(backendById.get(model.id)?.usageClass).toBe(model.usageClass)
    }
    expect(chatModels.find((m) => m.id === 'auto')?.usageClass).toBe('ADVANCED')
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

    test(`${name}: both consumers accept every entry and classify identically`, () => {
      const backendById = byId(backend)
      for (const model of chat) {
        const backendModel = backendById.get(model.id)
        expect(
          backendModel,
          `missing backend entry for ${model.id}`
        ).toBeDefined()
        expect(backendModel?.usageClass).toBe(model.usageClass)
      }
      expect(chat.find((m) => m.id === 'auto')?.usageClass).toBe('ADVANCED')
    })
  }
})
