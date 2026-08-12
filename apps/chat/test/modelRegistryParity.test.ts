import { describe, expect, test } from 'vitest'
import { DEFAULT_CHAT_MODEL_REGISTRY } from '../../../packages/graphql/src/services/chatbots'
import { DEFAULT_MODEL_REGISTRY } from '../src/lib/server/chatModelRegistry'

// The chat app and the GraphQL backend each carry their own built-in chat model
// registry (both overridable through CHAT_MODEL_REGISTRY_JSON). The backend copy
// drives the lecturer-facing allow-list in manage, the chat copy drives what
// students actually get. When they drift, lecturers can allow-list models that
// never reach students. The chat side is the source of truth.

type ParityModel = {
  id: string
  deploymentId: string
  fallback: boolean
  supportsReasoning: boolean
  usesResponsesApi?: boolean
  supportedReasoningEfforts: string[]
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
})
