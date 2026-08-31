import {
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  SearchIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FC, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  isDocQueryToolName,
  normalizeSourcesFromParts,
  parseDocQueryPayload,
} from '@/src/lib/sources/normalizeSources'
import type { Translate } from '@/src/lib/sources/sourceDisplay'

const MAX_PREVIEW_LINES = 10

function TruncatedOutput({ text }: { text: string }) {
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)
  const lines = text.split('\n')
  const needsTruncation = lines.length > MAX_PREVIEW_LINES

  if (!needsTruncation || showAll) {
    return (
      <div>
        <pre className="whitespace-pre-wrap text-xs">{text}</pre>
        {needsTruncation && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
          >
            {t('chat.toolFallback.showLess')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <pre className="whitespace-pre-wrap text-xs">
        {lines.slice(0, MAX_PREVIEW_LINES).join('\n')}
      </pre>
      <button
        type="button"
        onClick={() => setShowAll(true)}
        className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
      >
        {t('chat.toolFallback.showMore', {
          count: lines.length - MAX_PREVIEW_LINES,
        })}
      </button>
    </div>
  )
}

/**
 * MCP tools arrive namespaced as `Server_tool_name` (see `toSafeToolName` in
 * `services/mcpClients.ts`). Students have no use for the server slug, so the
 * chip shows the readable tool part only and the raw identifier moves into the
 * expanded panel.
 *
 * Two accepted limitations of that trade-off:
 * - A chatbot may have several MCP servers on one mode, so two servers exposing
 *   the same tool name collapse to the same chip label. Expanding tells them
 *   apart; the alternative — a server badge on every chip — puts a slug back in
 *   front of students for a case they will rarely hit.
 * - Tool names come from third parties, so no transform guarantees plain
 *   language: `queryDocuments` stays `queryDocuments`. Only `_` is unpacked.
 */
function formatToolName(raw: string) {
  const sep = raw.indexOf('_')
  return (sep === -1 ? raw : raw.slice(sep + 1)).replace(/_/g, ' ')
}

export type DocQueryChipState = 'running' | 'done' | 'doneEmpty' | 'failed'

/**
 * Picks which of the four friendly `chat.tools.*` messages the doc_query
 * chip should show. Pure so it can be unit-tested without mounting the
 * component.
 *
 * "No results" is claimed only for a payload that actually parsed and
 * yielded no sources. Anything unreadable stays plain "done": a cancelled
 * call leaves the `'Loading...'`/`'Executing...'` placeholder from
 * `hooks/useChatResponse.ts` behind as the result, and telling a student
 * their search found nothing would be worse than saying nothing at all.
 */
export function getDocQueryChipState({
  toolName,
  isRunning,
  isFailed,
  result,
  isError,
}: {
  toolName: string
  isRunning: boolean
  isFailed: boolean
  result: unknown
  isError?: boolean
}): DocQueryChipState {
  if (isFailed) return 'failed'
  if (isRunning) return 'running'
  if (!parseDocQueryPayload(result)) return 'done'

  const sources = normalizeSourcesFromParts([
    { type: 'tool-call', toolName, result, isError },
  ])
  return sources.length > 0 ? 'done' : 'doneEmpty'
}

function docQueryChipLabel(t: Translate, state: DocQueryChipState): string {
  switch (state) {
    case 'running':
      return t('chat.tools.searchingCourseMaterial')
    case 'doneEmpty':
      return t('chat.tools.searchedCourseMaterialEmpty')
    case 'failed':
      return t('chat.tools.searchCourseMaterialFailed')
    case 'done':
      return t('chat.tools.searchedCourseMaterial')
  }
}

/**
 * Extracts the search query a model issued to a doc_query tool from its
 * (possibly still-streaming) JSON args text — `{ "query": "...", ... }`.
 * Parses defensively: partial/non-JSON argsText, or a payload with no
 * non-empty string `query` field, both read as "nothing to show" rather than
 * throwing.
 */
export function parseDocQueryArgsQuery(argsText: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(argsText)
  } catch {
    return undefined
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined
  }

  const query = (parsed as Record<string, unknown>).query
  return typeof query === 'string' && query.trim().length > 0
    ? query
    : undefined
}

export interface DocQueryPanelContent {
  query?: string
  showSourcesHint: boolean
}

/**
 * Friendly, non-raw content for an expanded doc_query tool call's panel, or
 * `undefined` when the raw tool-name/args/result fallback should render
 * instead: a non-doc_query tool, or a doc_query result that never parsed
 * (running, cancelled, or failed calls all leave `result` as a
 * placeholder/error value — see `getDocQueryChipState` — whose raw payload
 * keeps its debugging value).
 *
 * `'done'` only ever reaches here once `parseDocQueryPayload(result)` above
 * has already succeeded, so — unlike the chip label — it unambiguously means
 * "parsed with at least one source" and is safe to key the sources hint on.
 */
export function getDocQueryPanelContent({
  isDocQuery,
  argsText,
  result,
  docQueryState,
}: {
  isDocQuery: boolean
  argsText: string
  result: unknown
  docQueryState: DocQueryChipState | undefined
}): DocQueryPanelContent | undefined {
  if (
    !isDocQuery ||
    docQueryState === 'running' ||
    docQueryState === 'failed' ||
    !parseDocQueryPayload(result)
  ) {
    return undefined
  }

  const query = parseDocQueryArgsQuery(argsText)
  const showSourcesHint = docQueryState === 'done'
  // doneEmpty with unreadable args would yield a panel with nothing in it —
  // fall back to the raw payload instead.
  if (query === undefined && !showSourcesHint) {
    return undefined
  }

  return { query, showSourcesHint }
}

interface ToolFallbackProps {
  toolName: string
  argsText: string
  result?: unknown
  status: { type: string }
  isError?: boolean
}

export const ToolFallback: FC<ToolFallbackProps> = ({
  toolName,
  argsText,
  result,
  status,
  isError,
}) => {
  const t = useTranslations()
  const [isCollapsed, setIsCollapsed] = useState(true)
  const isRunning = status.type === 'running'
  const isFailed = isError === true && !isRunning
  const tool = formatToolName(toolName)
  const isDocQuery = isDocQueryToolName(toolName)

  const docQueryState = isDocQuery
    ? getDocQueryChipState({ toolName, isRunning, isFailed, result, isError })
    : undefined

  const docQueryPanelContent = getDocQueryPanelContent({
    isDocQuery,
    argsText,
    result,
    docQueryState,
  })

  const resultText =
    result === undefined
      ? undefined
      : typeof result === 'string'
        ? result
        : JSON.stringify(result, null, 2)

  return (
    <div className="mb-0.5">
      <button
        type="button"
        data-cy="chat-tool-call-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        className={twMerge(
          'inline-flex min-h-8 items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors touch-manipulation [@media(pointer:coarse)]:min-h-11',
          isFailed
            ? 'bg-destructive/10 text-foreground hover:bg-destructive/20'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        {/* Keep a fixed status slot so trace labels align across row types. */}
        {isCollapsed ? (
          <ChevronRightIcon className="size-3" aria-hidden />
        ) : (
          <ChevronDownIcon className="size-3" aria-hidden />
        )}
        <span
          className="inline-flex size-3 shrink-0 items-center justify-center"
          aria-hidden
        >
          {isRunning && (
            <LoaderCircleIcon className="text-primary size-3 animate-spin" />
          )}
          {isFailed && <AlertCircleIcon className="text-destructive size-3" />}
          {(docQueryState === 'done' || docQueryState === 'doneEmpty') && (
            <SearchIcon className="size-3" />
          )}
        </span>
        {docQueryState
          ? docQueryChipLabel(t, docQueryState)
          : isFailed
            ? t('chat.toolFallback.failed', { tool })
            : isRunning
              ? t('chat.toolFallback.running', { tool })
              : t('chat.toolFallback.done', { tool })}
      </button>

      <div
        aria-hidden={isCollapsed}
        // `inert` (not just aria-hidden): the collapsed panel stays mounted
        // for the height animation, and TruncatedOutput's "Show more" button
        // inside it must not remain tabbable while visually collapsed.
        inert={isCollapsed}
        className={twMerge(
          'grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none',
          isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="bg-muted mt-1 rounded p-2 text-xs">
            {/* Not `text-muted-foreground`: that token only reaches 4.39:1 on
                `--muted`, under the 4.5:1 AA floor for 12px text. */}
            {docQueryPanelContent ? (
              <>
                {docQueryPanelContent.query !== undefined && (
                  <p>
                    <span className="font-medium">
                      {t('chat.toolFallback.docQueryQueryLabel')}:
                    </span>{' '}
                    {docQueryPanelContent.query}
                  </p>
                )}
                {docQueryPanelContent.showSourcesHint && (
                  <p
                    className={docQueryPanelContent.query ? 'mt-1' : undefined}
                  >
                    {t('chat.toolFallback.docQuerySourcesHint')}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mb-1 font-mono">{toolName}</p>
                <pre className="whitespace-pre-wrap">{argsText}</pre>
                {resultText !== undefined && (
                  <div className="border-border mt-2 border-t border-dashed pt-2">
                    <TruncatedOutput text={resultText} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
