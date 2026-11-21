'use client'

import { Maximize2, Minimize2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'
import { twMerge } from 'tailwind-merge'
import { useFramed } from '../hooks/useFramed'
import { useFullscreenActive } from './chat-ui-context'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const subscribeToNothing = () => () => {}

/**
 * Lets a framed chat take over the whole screen, because the host page
 * (an LMS course view, for example) keeps its own navigation around the frame.
 *
 * The host decides whether this is possible: a cross-origin frame may only
 * request fullscreen when its `<iframe>` grants the permission. The browser
 * reports that through `document.fullscreenEnabled`, so the control renders
 * nothing where the host or the browser does not allow it. An unframed chat
 * already owns its window and gets no control.
 *
 * The whole document goes fullscreen, not one element, so that dialogs,
 * tooltips and menus portalled to `document.body` stay visible.
 */
export function FullscreenToggle({ className }: { className?: string }) {
  const t = useTranslations()
  const framed = useFramed()
  const available = useSyncExternalStore(
    subscribeToNothing,
    () => document.fullscreenEnabled === true,
    () => false
  )
  const active = useFullscreenActive()

  if (!framed || !available) return null

  const label = t(active ? 'chat.fullscreen.exit' : 'chat.fullscreen.enter')

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // The browser or the host refused the request; the chat stays usable in
      // its frame and `fullscreenchange` never fires, so the control keeps
      // offering the same action.
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-cy="chat-fullscreen-toggle"
          onClick={toggle}
          className={twMerge(
            'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 fine-pointer:size-8',
            className
          )}
        >
          {active ? (
            <Minimize2 aria-hidden="true" className="size-4" />
          ) : (
            <Maximize2 aria-hidden="true" className="size-4" />
          )}
          <span className="sr-only">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
