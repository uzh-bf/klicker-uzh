'use client'

import { Megaphone, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

interface ChatProductUpdate {
  id: string
  publishedAt: string
  title: string
  summary: string
  detailsUrl?: string
  readAt: string | null
  dismissedAt: string | null
}

// Every call is best effort. A product update is an announcement, not part of
// the conversation, so a failing request leaves the panel silent instead of
// surfacing an error or retrying into a loop next to the chat the user came for.
async function postState(updateId: string, action: string): Promise<void> {
  try {
    await fetch('/api/product-updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updateId, action }),
    })
  } catch {
    /* best effort */
  }
}

export function ProductUpdatesPanel() {
  const t = useTranslations()
  const [updates, setUpdates] = useState<ChatProductUpdate[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Presentations are counted per mount, and React re-invokes effects in
  // development strict mode, so the ids already reported are remembered here to
  // keep the counter honest.
  const presentedIds = useRef(new Set<string>())

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const response = await fetch('/api/product-updates')
        // A participant without a full account gets 403 here; that is a quiet
        // "not your surface", not an error worth showing.
        if (!response.ok) return

        const data = await response.json()
        if (!active || !Array.isArray(data.updates)) return

        setUpdates(data.updates)

        for (const update of data.updates as ChatProductUpdate[]) {
          if (presentedIds.current.has(update.id)) continue
          presentedIds.current.add(update.id)
          void postState(update.id, 'presented')
        }
      } catch {
        /* best effort */
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const handleToggle = useCallback((update: ChatProductUpdate) => {
    setExpandedId((current) => (current === update.id ? null : update.id))

    // Opening an entry is the first moment the participant demonstrably read
    // more than its title. The first read wins server-side, so re-opening it
    // does not move the timestamp.
    if (!update.readAt) {
      void postState(update.id, 'read')
      setUpdates((current) =>
        current.map((entry) =>
          entry.id === update.id
            ? { ...entry, readAt: new Date().toISOString() }
            : entry
        )
      )
    }
  }, [])

  const handleDismiss = useCallback((updateId: string) => {
    // Dropped locally right away: a dismissal the participant has to wait for
    // reads as a broken button.
    setUpdates((current) => current.filter((entry) => entry.id !== updateId))
    void postState(updateId, 'dismiss')
  }, [])

  if (updates.length === 0) return null

  return (
    <div
      data-cy="chat-product-updates-section"
      className="space-y-1.5 border-t px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <Megaphone className="size-4" />
        <span className="text-sm font-medium">
          {t('chat.productUpdates.title')}
        </span>
      </div>

      <ul className="space-y-1">
        {updates.map((update) => {
          const isExpanded = expandedId === update.id
          return (
            <li key={update.id} data-cy="chat-product-update-item">
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  data-cy="chat-product-update-toggle"
                  onClick={() => handleToggle(update)}
                  aria-expanded={isExpanded}
                  className="flex-1 text-left text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    {!update.readAt ? (
                      <span
                        data-cy="chat-product-update-unread"
                        className="bg-primary size-1.5 shrink-0 rounded-full"
                        // The dot is the only unread marker, so it needs an
                        // accessible name of its own.
                        role="img"
                        aria-label={t('chat.productUpdates.unread')}
                      />
                    ) : null}
                    <span className="text-foreground font-medium">
                      {update.title}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  data-cy="chat-product-update-dismiss"
                  onClick={() => handleDismiss(update.id)}
                  className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-0.5"
                >
                  <X className="size-3.5" />
                  <span className="sr-only">
                    {t('chat.productUpdates.dismiss')}
                  </span>
                </button>
              </div>

              {isExpanded ? (
                <div
                  data-cy="chat-product-update-body"
                  className="text-muted-foreground mt-1 space-y-1 text-xs"
                >
                  <p className="text-pretty">{update.summary}</p>
                  {update.detailsUrl ? (
                    <a
                      href={update.detailsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-block underline"
                    >
                      {t('chat.productUpdates.details')}
                      <span className="sr-only">
                        {' '}
                        {t('chat.common.opensInNewTab')}
                      </span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
