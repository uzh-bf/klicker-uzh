'use client'

import { useAuiState } from '@assistant-ui/react'
import { Markdown } from '@klicker-uzh/markdown'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { getCandidateSourceKey } from '@/src/lib/sources/normalizeSources'
import { useChatStore } from '@/src/stores/chatStore'
import { CitationChip } from '../citation-chip'
import { useMessageSourcesContext } from '../message-sources-context'
import { SourcePreviewContent } from '../source-preview-content'
import { isFailedCandidateAttemptInMessages } from './runtime-context'

const EMPTY_MESSAGES: never[] = []

type Candidate = {
  type: 'FLASHCARD'
  candidateId: string
  name: string
  content: string
  explanation: string
  sourceMessageId: string
  sourceToolCallId: string
  sources: Array<{
    sourceId: string
    chunkId: string
    title?: string
    url?: string
    page?: number
  }>
}

type CandidatePart = {
  toolCallId: string
  toolName: string
  result?: unknown
  status: { type: string }
}

type CandidateResult = {
  status?: string
  completed?: number
  total?: number
}

type PendingAction = {
  candidateId: string
  action: 'save' | 'discard'
} | null

type CandidateDecisionState = {
  courseId?: unknown
  elements?: Array<{ candidateId?: unknown }>
  discardedCandidateIds?: unknown
}

type CandidateDecisionResponse = {
  ok: boolean
  status: number
  json: () => Promise<CandidateDecisionState>
}

const DECISION_STATE_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000] as const

export async function fetchCandidateDecisionState(
  url: string,
  fetcher: (url: string) => Promise<CandidateDecisionResponse> = fetch,
  sleep: (delayMs: number) => Promise<void> = (delayMs) =>
    new Promise((resolve) => setTimeout(resolve, delayMs))
): Promise<CandidateDecisionState> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetcher(url)
    if (response.ok) return response.json()

    const retryDelay = DECISION_STATE_RETRY_DELAYS_MS[attempt]
    if (response.status !== 409 || retryDelay === undefined) {
      throw new Error('Could not load card state')
    }
    await sleep(retryDelay)
  }
}

export function shouldExposeCandidateDecisionState(
  statusType: string,
  loadedKey: string | null,
  currentKey: string
) {
  return statusType === 'complete' && loadedKey === currentKey
}

export function shouldLoadCandidateDecisionState(
  statusType: string,
  messageStatusType: string | undefined,
  messages: readonly { id?: string; content?: unknown }[],
  messageId: string,
  toolCallId: string
) {
  if (statusType !== 'complete' || messageStatusType !== 'complete')
    return false
  const message = messages.find((candidate) => candidate.id === messageId)
  if (!message || !Array.isArray(message.content)) return false
  return message.content.some(
    (part) =>
      !!part &&
      typeof part === 'object' &&
      (part as { toolName?: unknown }).toolName === 'generate_cards' &&
      (part as { toolCallId?: unknown }).toolCallId === toolCallId
  )
}

function candidatesFromResult(result: unknown): Candidate[] {
  if (!result || typeof result !== 'object') return []
  const values = (result as { candidates?: unknown }).candidates
  if (!Array.isArray(values)) return []
  return values.filter(
    (value): value is Candidate =>
      !!value &&
      typeof value === 'object' &&
      (value as Candidate).type === 'FLASHCARD' &&
      typeof (value as Candidate).candidateId === 'string' &&
      typeof (value as Candidate).name === 'string' &&
      typeof (value as Candidate).content === 'string' &&
      typeof (value as Candidate).explanation === 'string' &&
      typeof (value as Candidate).sourceMessageId === 'string' &&
      typeof (value as Candidate).sourceToolCallId === 'string' &&
      Array.isArray((value as Candidate).sources)
  )
}

function progressFromResult(result: unknown): CandidateResult {
  if (!result || typeof result !== 'object') return {}
  const value = result as CandidateResult
  return {
    status: typeof value.status === 'string' ? value.status : undefined,
    completed:
      typeof value.completed === 'number' ? value.completed : undefined,
    total: typeof value.total === 'number' ? value.total : undefined,
  }
}

export function CandidateCards({ part }: { part: CandidatePart }) {
  const t = useTranslations()
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const message = useAuiState((state) => state.message)
  const { sources: messageSources } = useMessageSourcesContext()
  const candidates = useMemo(
    () => candidatesFromResult(part.result),
    [part.result]
  )
  const activeMessages = useChatStore((state) => {
    const activeThread = state.threads.find(
      (thread) => thread.id === state.activeThreadId
    )
    return activeThread?.messages ?? EMPTY_MESSAGES
  })
  const candidateToolName =
    part.toolName === 'generate_cards' ? part.toolName : null
  const failedCandidateAttempt =
    candidateToolName !== null &&
    isFailedCandidateAttemptInMessages(
      activeMessages,
      message.id,
      part.toolCallId,
      candidateToolName
    )
  const [saved, setSaved] = useState<string[] | null>(null)
  const [discarded, setDiscarded] = useState<string[]>([])
  const [loadedDecisionKey, setLoadedDecisionKey] = useState<string | null>(
    null
  )
  const [savedStateAttempt, setSavedStateAttempt] = useState(0)
  const [savedStateError, setSavedStateError] = useState(false)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionError, setActionError] = useState<'save' | 'discard' | null>(
    null
  )
  const isComplete = part.status.type === 'complete'
  const decisionKey = message.id + ':' + part.toolCallId
  const shouldLoadDecisionState =
    !failedCandidateAttempt &&
    shouldLoadCandidateDecisionState(
      part.status.type,
      message.status?.type,
      activeMessages,
      message.id,
      part.toolCallId
    )
  const decisionStateReady = shouldExposeCandidateDecisionState(
    part.status.type,
    loadedDecisionKey,
    decisionKey
  )
  const progress = progressFromResult(part.result)
  const progressCompleted = progress.completed ?? 0
  const progressTotal = progress.total ?? candidates.length
  const generationComplete =
    isComplete ||
    ((progress.status === 'complete' || progress.status === 'completed') &&
      (progressTotal === 0 || progressCompleted >= progressTotal))
  const generationPartial =
    progress.status === 'partial' &&
    progressTotal > 0 &&
    progressCompleted >= progressTotal
  const hasProgress =
    candidateToolName !== null &&
    (part.status.type === 'running' ||
      progress.status === 'partial' ||
      progress.status === 'complete' ||
      progress.status === 'completed' ||
      progress.status === 'error')

  useEffect(() => {
    if (!shouldLoadDecisionState) return

    let active = true
    const url =
      '/api/chatbots/' +
      chatbotId +
      '/personal-elements?messageId=' +
      encodeURIComponent(message.id) +
      '&toolCallId=' +
      encodeURIComponent(part.toolCallId) +
      '&attempt=' +
      savedStateAttempt
    void fetchCandidateDecisionState(url)
      .then((payload) => {
        if (!active) return
        const savedCandidateIds = (payload.elements ?? []).flatMap((element) =>
          typeof element.candidateId === 'string' ? [element.candidateId] : []
        )
        setSavedStateError(false)
        if (typeof payload.courseId === 'string') setCourseId(payload.courseId)
        setSaved(savedCandidateIds)
        setDiscarded(
          Array.isArray(payload.discardedCandidateIds)
            ? payload.discardedCandidateIds.filter(
                (id): id is string => typeof id === 'string'
              )
            : []
        )
        setLoadedDecisionKey(decisionKey)
      })
      .catch(() => {
        if (!active) return
        setSaved(null)
        setDiscarded([])
        setLoadedDecisionKey(null)
        setSavedStateError(true)
      })
    return () => {
      active = false
    }
  }, [
    chatbotId,
    decisionKey,
    message.id,
    part.toolCallId,
    savedStateAttempt,
    shouldLoadDecisionState,
  ])

  const savedIds = decisionStateReady ? (saved ?? []) : []

  const runAction = async (
    candidate: Candidate,
    action: 'save' | 'discard'
  ) => {
    if (
      !decisionStateReady ||
      saved === null ||
      !isComplete ||
      failedCandidateAttempt ||
      pendingAction !== null
    )
      return

    setPendingAction({ candidateId: candidate.candidateId, action })
    setActionError(null)
    try {
      const response = await fetch(
        '/api/chatbots/' + chatbotId + '/personal-elements',
        {
          method: action === 'save' ? 'POST' : 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messageId: message.id,
            toolCallId: part.toolCallId,
            candidateId: candidate.candidateId,
          }),
        }
      )
      if (!response.ok) throw new Error('Could not update card')
      const payload = (await response.json()) as { courseId?: unknown }
      if (typeof payload.courseId === 'string') setCourseId(payload.courseId)
      if (action === 'save') {
        setSaved((previous) => [
          ...new Set([...(previous ?? []), candidate.candidateId]),
        ])
      } else {
        setDiscarded((previous) => [
          ...new Set([...previous, candidate.candidateId]),
        ])
      }
    } catch {
      setActionError(action)
    } finally {
      setPendingAction(null)
    }
  }

  if (candidateToolName === null || (candidates.length === 0 && !hasProgress)) {
    return null
  }

  return (
    <section className="my-2 space-y-3" data-cy="generated-candidate-cards">
      {hasProgress ? (
        <div
          className="bg-muted/30 rounded border px-3 py-2 text-sm"
          data-cy="personal-element-generation-progress"
          aria-live="polite"
        >
          <span className="font-medium">
            {progress.status === 'error'
              ? t('chat.personalElements.generationFailed')
              : generationPartial
                ? t('chat.personalElements.generationPartial')
                : generationComplete
                  ? t('chat.personalElements.generationComplete')
                  : t('chat.personalElements.generating')}
          </span>
          {progressTotal > 0 && progress.status !== 'error' ? (
            <span className="text-muted-foreground ml-2">
              {t('chat.personalElements.generationProgress', {
                completed: Math.min(progressCompleted, progressTotal),
                total: progressTotal,
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {candidates.map((candidate) => {
        const isSaved = savedIds.includes(candidate.candidateId)
        const isDiscarded =
          decisionStateReady && discarded.includes(candidate.candidateId)
        const sourceReferences = candidate.sources.flatMap((source) => {
          const normalized = messageSources.find(
            (messageSource) =>
              messageSource.id === getCandidateSourceKey(source)
          )
          return normalized
            ? [{ index: normalized.index, source: normalized }]
            : []
        })
        const explanation = candidate.explanation

        return (
          <article
            key={candidate.candidateId}
            className={
              isDiscarded
                ? 'rounded-lg border p-3 opacity-70'
                : 'rounded-lg border p-3'
            }
          >
            <strong className="block">{candidate.name}</strong>
            <Markdown
              content={candidate.content}
              withLinkButtons={false}
              withModal={false}
              withProse
              className={{ root: 'prose-sm mt-1' }}
            />
            {explanation ? (
              <Markdown
                content={explanation}
                withLinkButtons={false}
                withModal={false}
                withProse
                className={{
                  root: 'prose-sm text-muted-foreground mt-2',
                }}
              />
            ) : null}
            {sourceReferences.length > 0 ? (
              <div
                className="mt-3 space-y-2 text-xs"
                data-cy="personal-element-references"
              >
                <p className="text-muted-foreground font-semibold uppercase tracking-wide">
                  {t('chat.personalElements.references')}
                </p>
                <div className="space-y-1">
                  {sourceReferences.map(({ index, source }) => {
                    const preview = source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 hover:underline"
                      >
                        <SourcePreviewContent source={source} />
                        <span className="sr-only">
                          {t('chat.common.opensInNewTab')}
                        </span>
                      </a>
                    ) : (
                      <SourcePreviewContent source={source} />
                    )

                    return (
                      <div
                        key={source.id}
                        className="border-border bg-muted/20 flex items-start gap-2 rounded border p-2 text-left"
                      >
                        <CitationChip index={index} />
                        {preview}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
            {failedCandidateAttempt && !isSaved ? (
              <div
                className="text-muted-foreground mt-2 text-sm font-medium"
                data-cy="personal-element-candidate-unavailable"
              >
                {t('chat.personalElements.candidateUnavailable')}
              </div>
            ) : null}
            {isSaved ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-green-700">
                  {t('chat.personalElements.saved')}
                </span>
                {courseId ? (
                  <a
                    className="underline"
                    href={
                      (process.env.NEXT_PUBLIC_PWA_URL ??
                        'https://pwa.klicker.uzh.ch') +
                      '/course/' +
                      courseId +
                      '/personal'
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('chat.personalElements.practiceNow')}
                  </a>
                ) : null}
              </div>
            ) : null}
            {isDiscarded ? (
              <div
                className="text-muted-foreground mt-2 text-sm font-medium"
                data-cy="personal-element-candidate-discarded"
              >
                {t('chat.personalElements.discarded')}
              </div>
            ) : null}
            {!isSaved && !isDiscarded && !failedCandidateAttempt ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pendingAction !== null || !decisionStateReady}
                  onClick={() => void runAction(candidate, 'save')}
                  className="bg-primary text-primary-foreground min-h-10 rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pendingAction?.candidateId === candidate.candidateId &&
                  pendingAction.action === 'save'
                    ? t('chat.personalElements.saving')
                    : t('chat.personalElements.save')}
                </button>
                <button
                  type="button"
                  disabled={pendingAction !== null || !decisionStateReady}
                  onClick={() => void runAction(candidate, 'discard')}
                  className="border-border min-h-10 rounded border px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pendingAction?.candidateId === candidate.candidateId &&
                  pendingAction.action === 'discard'
                    ? t('chat.personalElements.discarding')
                    : t('chat.personalElements.discard')}
                </button>
              </div>
            ) : null}
          </article>
        )
      })}

      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {t(
            actionError === 'discard'
              ? 'chat.personalElements.discardError'
              : 'chat.personalElements.saveError'
          )}
        </p>
      ) : null}
      {savedStateError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-destructive text-sm" role="alert">
            {t('chat.personalElements.savedStateError')}
          </p>
          <button
            type="button"
            className="border-border min-h-10 rounded border px-3 py-2 text-sm font-medium"
            onClick={() => {
              setSavedStateAttempt((attempt) => attempt + 1)
              setSavedStateError(false)
              setSaved(null)
            }}
          >
            {t('chat.personalElements.savedStateRetry')}
          </button>
        </div>
      ) : null}
    </section>
  )
}

type RevisionPart = {
  result?: unknown
  status: { type: string }
}

type RevisionResult = {
  status: 'updated' | 'conflict'
  version?: number
  name?: string
  content?: string
  explanation?: string
  sources?: Array<{
    sourceId?: string
    chunkId?: string
    title?: string
    page?: number
  }>
  reason?: string
}

function revisionFromResult(result: unknown): RevisionResult | null {
  if (!result || typeof result !== 'object') return null
  const value = result as Partial<RevisionResult>
  if (value.status !== 'updated' && value.status !== 'conflict') return null
  return value as RevisionResult
}

export function SavedRevisionCard({ part }: { part: RevisionPart }) {
  const t = useTranslations()
  const revision = revisionFromResult(part.result)
  if (!revision) return null

  if (revision.status === 'conflict') {
    return (
      <article
        className="border-destructive/50 bg-destructive/10 rounded-lg border p-3 text-sm"
        data-cy="personal-element-revision-conflict"
        role="alert"
      >
        {revision.reason ?? t('chat.personalElements.revisionConflict')}
      </article>
    )
  }

  return (
    <article
      className="my-2 space-y-2 rounded-lg border p-3"
      data-cy="personal-element-revision"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{revision.name}</strong>
        {typeof revision.version === 'number' ? (
          <span className="text-muted-foreground text-xs">
            {t('chat.personalElements.revisionUpdated', {
              version: revision.version,
            })}
          </span>
        ) : null}
      </div>
      <p className="text-sm">{revision.content}</p>
      <p className="text-muted-foreground text-sm">{revision.explanation}</p>
      {revision.sources && revision.sources.length > 0 ? (
        <div className="text-muted-foreground text-xs">
          {revision.sources.map((source) => (
            <span
              key={
                (source.sourceId ?? 'source') +
                ':' +
                (source.chunkId ?? 'chunk')
              }
              className="mr-2 inline-block rounded bg-slate-100 px-2 py-1"
            >
              {source.title ?? source.sourceId ?? source.chunkId}
              {typeof source.page === 'number'
                ? ' · ' + t('chat.sources.page', { page: source.page })
                : ''}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}
