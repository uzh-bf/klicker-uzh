'use client'

import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authedFetch } from '@/src/lib/client/authedFetch'
import type { ConceptLinkTerm } from '@/src/lib/markdown/remarkConceptLinks'
import { isKnowledgeGraphResponse } from './ChatKnowledgeGraphWorkspace'

export type ChatGraphConceptContextValue = {
  chatbotId: string
  focusConcept: (response: KnowledgeGraphResponse, nodeId: string) => void
}

/** Present only while the chatbot's participant concept map is enabled. */
export const ChatGraphConceptContext =
  createContext<ChatGraphConceptContextValue | null>(null)

export type ConceptMentions = {
  response: KnowledgeGraphResponse
  terms: ConceptLinkTerm[]
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

const MENTION_TEXT_LIMIT = 8000
const MENTION_CACHE_LIMIT = 50
// Finished answers do not change, so a remount or thread reload reuses the
// lookup instead of asking the graph again.
const mentionCache = new Map<string, Promise<ConceptMentions | null>>()
// The graph route admits one read per participant at a time, so a reloaded
// thread looks up its answers one after another instead of all at once.
let mentionQueue: Promise<unknown> = Promise.resolve()

function isConceptTerm(value: unknown): value is ConceptLinkTerm {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ConceptLinkTerm).nodeId === 'string' &&
    typeof (value as ConceptLinkTerm).text === 'string'
  )
}

export async function readConceptMentions(
  chatbotId: string,
  text: string,
  fetcher: Fetcher = authedFetch
): Promise<ConceptMentions | null> {
  const response = await fetcher(
    `/api/chatbots/${encodeURIComponent(chatbotId)}/knowledge-graph?operation=mentions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, MENTION_TEXT_LIMIT) }),
    }
  )
  if (!response.ok) return null
  const body: unknown = await response.json().catch(() => null)
  if (!isKnowledgeGraphResponse(body)) return null
  const mentions = (body as { mentions?: unknown }).mentions
  if (!Array.isArray(mentions) || !mentions.every(isConceptTerm)) return null
  const nodeIds = new Set(body.nodes.map((node) => node.id))
  return {
    response: body,
    terms: mentions.filter((mention) => nodeIds.has(mention.nodeId)),
  }
}

function cachedConceptMentions(chatbotId: string, text: string) {
  const key = `${chatbotId}\u0000${text}`
  const cached = mentionCache.get(key)
  if (cached) return cached
  const loaded = mentionQueue
    .then(() => readConceptMentions(chatbotId, text))
    .catch(() => null)
  mentionQueue = loaded
  mentionCache.set(key, loaded)
  // A failed or busy lookup is retried on the next render of the answer.
  void loaded.then((value) => {
    if (value === null) mentionCache.delete(key)
  })
  if (mentionCache.size > MENTION_CACHE_LIMIT) {
    const oldest = mentionCache.keys().next().value
    if (oldest !== undefined) mentionCache.delete(oldest)
  }
  return loaded
}

/**
 * Concepts named in a finished answer. Returns null while the answer streams,
 * when the concept map is disabled, or when the lookup fails, so the answer
 * renders exactly as before.
 */
export function useConceptMentions(
  text: string,
  complete: boolean
): (ConceptMentions & ChatGraphConceptContextValue) | null {
  const context = useContext(ChatGraphConceptContext)
  const [state, setState] = useState<{
    key: string
    value: ConceptMentions | null
  } | null>(null)
  const chatbotId = context?.chatbotId
  const key =
    chatbotId && complete && text.trim() ? `${chatbotId}:${text}` : null

  useEffect(() => {
    if (key === null || chatbotId === undefined) return
    let active = true
    void cachedConceptMentions(chatbotId, text).then((value) => {
      if (active) setState({ key, value })
    })
    return () => {
      active = false
    }
  }, [chatbotId, key, text])

  const value = state?.key === key ? state.value : null
  return useMemo(
    () =>
      context === null || value === null || value.terms.length === 0
        ? null
        : { ...value, ...context },
    [context, value]
  )
}
