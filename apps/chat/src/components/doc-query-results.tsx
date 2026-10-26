import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type {
  DocQueryChunk,
  DocQueryGroup,
} from '../lib/sources/docQueryResult'
import {
  formatTimestamp,
  getSourcePageLabel,
} from '../lib/sources/sourceDisplay'
import { useMessageSourcesContext } from './message-sources-context'

function Chunk({ chunk }: { chunk: DocQueryChunk }) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const content = chunk.content ?? ''
  const long = content.length > 480
  const pageLabel = getSourcePageLabel(chunk.labeledPage)
  return (
    <li data-cy="chat-doc-query-chunk" className="border-border border-t pt-3">
      <div className="text-muted-foreground mb-2 flex flex-wrap gap-2 text-xs">
        {pageLabel && (
          <span>{t('chat.sources.page', { page: pageLabel })}</span>
        )}
        {!pageLabel &&
          chunk.startSec === undefined &&
          chunk.labeledPage?.trim() && <span>{chunk.labeledPage.trim()}</span>}
        {chunk.startSec !== undefined && (
          <span>
            {formatTimestamp(chunk.startSec)}
            {chunk.endSec !== undefined
              ? `–${formatTimestamp(chunk.endSec)}`
              : ''}
          </span>
        )}
        {chunk.url && (
          <a
            href={chunk.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {t('chat.toolFallback.openSource')}
            <span className="sr-only"> {t('chat.common.opensInNewTab')}</span>
          </a>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
        {content
          ? long && !expanded
            ? `${content.slice(0, 480).replace(/[\uD800-\uDBFF]$/, '')}…`
            : content
          : t('chat.toolFallback.chunkUnavailable')}
      </p>
      {long && (
        <button
          type="button"
          data-cy="chat-doc-query-content-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="mt-2 min-h-9 text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2"
        >
          {expanded
            ? t('chat.toolFallback.showLess')
            : t('chat.toolFallback.showFullChunk')}
        </button>
      )}
    </li>
  )
}

function SourceGroup({ group }: { group: DocQueryGroup }) {
  const t = useTranslations()
  const { sources } = useMessageSourcesContext()
  const [visible, setVisible] = useState(5)
  const citation = group.citationId
    ? sources.find((source) => source.id === group.citationId)
    : undefined
  return (
    <section
      data-cy="chat-doc-query-group"
      className="border-border bg-background min-w-0 rounded-lg border p-3"
    >
      <h4 className="mb-1 flex items-start gap-2 break-words text-sm font-medium">
        {citation && (
          <span
            data-cy="chat-doc-query-citation"
            className="bg-primary/10 text-primary rounded px-1.5 font-mono"
          >
            {citation.index}
          </span>
        )}
        {group.title ?? t('chat.toolFallback.unnamedSource')}
      </h4>
      <p className="mb-3 break-all text-xs">
        {group.url ? (
          <a
            data-cy="chat-doc-query-origin"
            href={group.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {group.url}
            <span className="sr-only"> {t('chat.common.opensInNewTab')}</span>
          </a>
        ) : (
          t('chat.toolFallback.originUnavailable')
        )}
      </p>
      <ul className="space-y-3">
        {group.chunks.slice(0, visible).map((chunk) => (
          <Chunk key={chunk.id} chunk={chunk} />
        ))}
      </ul>
      {group.chunks.length > visible && (
        <button
          type="button"
          data-cy="chat-doc-query-more-chunks"
          onClick={() => setVisible(visible + 5)}
          className="mt-3 min-h-9 text-xs underline underline-offset-2"
        >
          {t('chat.toolFallback.moreChunks', {
            count: group.chunks.length - visible,
          })}
        </button>
      )}
    </section>
  )
}

export function DocQueryResults({ groups }: { groups: DocQueryGroup[] }) {
  const t = useTranslations()
  const [visible, setVisible] = useState(5)
  return (
    <div className="mt-3 space-y-3">
      {groups.slice(0, visible).map((group) => (
        <SourceGroup key={group.id} group={group} />
      ))}
      {groups.length > visible && (
        <button
          type="button"
          data-cy="chat-doc-query-more-sources"
          onClick={() => setVisible(visible + 5)}
          className="min-h-9 text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2"
        >
          {t('chat.toolFallback.moreSources', {
            count: groups.length - visible,
          })}
        </button>
      )}
    </div>
  )
}
