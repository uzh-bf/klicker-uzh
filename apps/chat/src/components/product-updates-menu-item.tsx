'use client'

import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@uzh-bf/design-system'
import { Megaphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ChatProductUpdateView,
  ProductUpdatesModal,
} from './product-updates-modal'

// Every call is best effort. A product update is an announcement, not part of
// the conversation, so a failing request leaves the entry silent instead of
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

export function ProductUpdatesMenuItem() {
  const t = useTranslations()
  const [updates, setUpdates] = useState<ChatProductUpdateView[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // Closing the feed has to put focus back where it came from, or a keyboard
  // user lands on the document body and has to tab through the whole page
  // again. Radix's own restore does not survive this modal — measured in the
  // browser: focus ends up on `<body>` — so the entry is refocused explicitly
  // once the dialog is gone.
  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true
      return
    }

    if (!wasOpen.current) return
    wasOpen.current = false
    triggerRef.current?.focus()
  }, [isOpen])

  // Loading the feed only fills the badge; nothing is recorded here. Mounting
  // the sidebar means the participant opened the application, not that an
  // announcement reached them.
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
      } catch {
        /* best effort */
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  // Seeing a card in the open feed is the first moment an entry demonstrably
  // reached the participant, so it both counts as a presentation and settles
  // the read timestamp. The mandated card shows its whole body at once, so
  // there is no later "opened it" gesture to wait for. The first read wins
  // server-side, which is why re-opening the feed does not move the timestamp.
  const handleSeen = useCallback((update: ChatProductUpdateView) => {
    void postState(update.id, 'presented')

    if (update.readAt) return

    void postState(update.id, 'read')
    setUpdates((current) =>
      current.map((entry) =>
        entry.id === update.id
          ? { ...entry, readAt: new Date().toISOString() }
          : entry
      )
    )
  }, [])

  const handleDismiss = useCallback((updateId: string) => {
    // Dropped locally right away: a dismissal the participant has to wait for
    // reads as a broken button.
    setUpdates((current) => current.filter((entry) => entry.id !== updateId))
    void postState(updateId, 'dismiss')
  }, [])

  if (updates.length === 0) return null

  const unreadCount = updates.filter((update) => !update.readAt).length

  return (
    <SidebarMenu data-cy="chat-product-updates-section">
      <SidebarMenuItem>
        <SidebarMenuButton
          ref={triggerRef}
          data-cy="chat-product-updates-trigger"
          onClick={() => setIsOpen(true)}
        >
          <Megaphone className="size-4" />
          <span>{t('chat.productUpdates.title')}</span>
        </SidebarMenuButton>
        {unreadCount > 0 ? (
          <SidebarMenuBadge
            data-cy="chat-product-updates-unread-badge"
            // The number alone reads as a bare digit next to the label, so the
            // badge carries its own accessible name.
            role="status"
            aria-label={t('chat.productUpdates.unreadCount', {
              count: unreadCount,
            })}
          >
            {unreadCount}
          </SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>

      <ProductUpdatesModal
        updates={updates}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSeen={handleSeen}
        onDismiss={handleDismiss}
      />
    </SidebarMenu>
  )
}
