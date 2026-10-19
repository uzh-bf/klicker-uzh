'use client'

import { useAui } from '@assistant-ui/react'
import { useCodeLanguageName } from '@klicker-uzh/code-runner/react'
import type { KnowledgeGraphAskSelection } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphView'
import { ArrowLeft, Maximize2, Minimize2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { twMerge } from 'tailwind-merge'
import {
  ArtifactSlot,
  focusArtifactLauncher,
  useArtifactWorkspace,
} from '../artifact-workspace'
import {
  type Artifact,
  activeArtifactId,
  type WorkspaceView,
} from '../artifact-workspace-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ChatKnowledgeGraphWorkspace } from './ChatKnowledgeGraphWorkspace'

const NARROW_QUERY = '(max-width: 1023px)'

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function useNarrowViewport() {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false
  )
}

/** Graph controls for the header toggle, backed by the page's workspace. */
export function useChatGraphPanel() {
  const workspace = useArtifactWorkspace()
  const open = workspace?.state.view === 'graph'
  return {
    open,
    toggle: () => (open ? workspace?.close() : workspace?.showGraph()),
  }
}

/**
 * The conversation with the workspace beside it. The workspace shows the
 * knowledge graph or one opened artifact; a switcher moves between them.
 * Artifacts open as a fullscreen dialog on narrow screens and in embedded
 * Chat. The graph stays mounted while the workspace is open, so switching
 * away and back keeps its viewport and selection.
 */
export function ChatKnowledgeGraphPanel({
  chatbotId,
  children,
}: {
  chatbotId: string
  children: ReactNode
}) {
  const t = useTranslations('chat.graphPanel')
  const tw = useTranslations('chat.workspace')
  const aui = useAui()
  const workspace = useArtifactWorkspace()
  const view: WorkspaceView = workspace?.state.view ?? null
  const open = view !== null
  const showingGraph = view === 'graph'
  const artifactId = activeArtifactId(view)
  const narrow = useNarrowViewport()
  const forcedFullscreen =
    artifactId !== null && (narrow || workspace?.alwaysFullscreen === true)
  const [fullscreenChoice, setFullscreenChoice] = useState(false)
  const fullscreen = forcedFullscreen || fullscreenChoice
  const [keepGraph, setKeepGraph] = useState(showingGraph)
  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const focusComposerRef = useRef(false)
  const previousView = useRef<WorkspaceView>(view)

  useEffect(() => {
    if (showingGraph) setKeepGraph(true)
    if (!open) {
      setKeepGraph(false)
      setFullscreenChoice(false)
    }
  }, [showingGraph, open])

  useEffect(() => {
    const previous = previousView.current
    previousView.current = view
    const previousArtifact = activeArtifactId(previous)
    if (previous === 'graph' && !open && !focusComposerRef.current) {
      document
        .querySelector<HTMLButtonElement>(
          '[data-cy="knowledge-graph-mode-link"]'
        )
        ?.focus()
    } else if (previousArtifact !== null && !open && workspace) {
      focusArtifactLauncher(workspace.containerFor(previousArtifact))
    }
    // Only an explicit Open shows an artifact, so it may take focus.
    if (artifactId !== null && artifactId !== previousArtifact) {
      headingRef.current?.focus()
    }
  }, [view, open, artifactId, workspace])

  useEffect(() => {
    if (!fullscreen || !open || !panelRef.current) return
    const changed: HTMLElement[] = []
    let element: HTMLElement | null = panelRef.current
    // Inert siblings at each ancestor keep both embedded and standalone
    // background controls out of the fullscreen focus order.
    while (element?.parentElement) {
      for (const sibling of Array.from(element.parentElement.children)) {
        if (
          sibling !== element &&
          sibling instanceof HTMLElement &&
          !sibling.inert
        ) {
          sibling.inert = true
          changed.push(sibling)
        }
      }
      element = element.parentElement
      if (element === document.body) break
    }
    if (!forcedFullscreen) expandRef.current?.focus()
    return () => {
      changed.forEach((element) => {
        element.inert = false
      })
    }
  }, [fullscreen, forcedFullscreen, open])

  useEffect(() => {
    if (!focusComposerRef.current || (fullscreen && open)) return
    focusComposerRef.current = false
    document
      .querySelector<HTMLTextAreaElement>('[data-cy="chat-composer-input"]')
      ?.focus()
  }, [fullscreen, open])

  function ask(selection: KnowledgeGraphAskSelection) {
    const prompt =
      selection.kind === 'node'
        ? t('nodePrompt', { topic: selection.label })
        : t('edgePrompt', {
            source: selection.source,
            target: selection.target,
            relationship: selection.label,
          })
    const text = aui.composer.getState().text
    aui.composer.setText(text.trim() ? `${text}\n\n${prompt}` : prompt)
    focusComposerRef.current = true
    setFullscreenChoice(false)
    if (window.matchMedia(NARROW_QUERY).matches) workspace?.close()
    // A docked desktop action has no state transition to trigger the effect.
    if (!fullscreen && window.matchMedia('(min-width: 1024px)').matches) {
      focusComposerRef.current = false
      document
        .querySelector<HTMLTextAreaElement>('[data-cy="chat-composer-input"]')
        ?.focus()
    }
  }

  // Opened artifacts in the order they appeared in the conversation.
  const switcherArtifacts = (workspace?.state.artifacts ?? []).filter(
    (artifact) =>
      workspace?.state.opened.includes(artifact.id) &&
      (workspace.state.present[artifact.id] ?? 0) > 0
  )
  const showSwitcher =
    switcherArtifacts.length + (workspace?.graphSwitchable ? 1 : 0) > 1

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col lg:flex-row"
      data-cy="chat-graph-layout"
    >
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        data-cy="chat-conversation-pane"
      >
        {children}
      </div>
      {open && workspace ? (
        <div
          id="chat-knowledge-graph-panel"
          ref={panelRef}
          {...(fullscreen
            ? { role: 'dialog', 'aria-modal': true as const }
            : { role: 'region' })}
          aria-label={showingGraph ? t('title') : tw('label')}
          data-cy={
            showingGraph ? 'chat-knowledge-graph-panel' : 'chat-workspace-panel'
          }
          data-fullscreen={fullscreen}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            // Nested graph controls stop propagation when they dismiss suggestions.
            // A tooltip preventing Escape must not prevent leaving fullscreen.
            if (event.key === 'Escape' && fullscreen) {
              event.preventDefault()
              if (forcedFullscreen) {
                workspace.close()
              } else {
                setFullscreenChoice(false)
                expandRef.current?.focus()
              }
            }
            if (event.key !== 'Tab' || !fullscreen) return
            const controls = Array.from(
              panelRef.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
              ) ?? []
            ).filter((element) => element.getClientRects().length > 0)
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }}
          className={twMerge(
            'bg-background flex min-h-0 min-w-0 flex-col',
            fullscreen
              ? 'fixed inset-0 z-50'
              : 'order-first h-[45%] min-h-60 shrink-0 border-b lg:order-last lg:h-auto lg:w-[42%] lg:min-w-[25rem] lg:max-w-[35rem] lg:border-b-0 lg:border-l'
          )}
        >
          <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1">
            {forcedFullscreen ? (
              <button
                type="button"
                onClick={workspace.close}
                data-cy="workspace-back-to-chat"
                className="hover:bg-accent focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 fine-pointer:min-h-8"
              >
                <ArrowLeft className="size-4" aria-hidden />
                {tw('backToChat')}
              </button>
            ) : null}
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="min-w-0 flex-1 truncate text-sm font-medium focus:outline-none"
            >
              {showingGraph ? t('title') : tw('label')}
            </h2>
            {forcedFullscreen ? null : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      ref={expandRef}
                      type="button"
                      aria-label={
                        showingGraph
                          ? t(fullscreen ? 'restore' : 'fullscreen')
                          : tw(fullscreen ? 'restore' : 'fullscreen')
                      }
                      onClick={() => setFullscreenChoice((value) => !value)}
                      data-cy={
                        showingGraph
                          ? 'knowledge-graph-fullscreen'
                          : 'workspace-fullscreen'
                      }
                      className="hover:bg-accent focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 fine-pointer:size-8"
                    >
                      {fullscreen ? (
                        <Minimize2 className="size-4" aria-hidden />
                      ) : (
                        <Maximize2 className="size-4" aria-hidden />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showingGraph
                      ? t(fullscreen ? 'restore' : 'fullscreen')
                      : tw(fullscreen ? 'restore' : 'fullscreen')}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={showingGraph ? t('close') : tw('close')}
                      onClick={workspace.close}
                      data-cy={
                        showingGraph
                          ? 'knowledge-graph-panel-close'
                          : 'workspace-close'
                      }
                      className="hover:bg-accent focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 fine-pointer:size-8"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showingGraph ? t('close') : tw('close')}
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
          {showSwitcher ? (
            <fieldset
              data-cy="workspace-switcher"
              className="m-0 flex min-w-0 shrink-0 gap-1 overflow-x-auto border-0 border-b px-3 py-1.5"
            >
              <legend className="sr-only">{tw('views')}</legend>
              {workspace.graphSwitchable ? (
                <SwitcherButton
                  current={showingGraph}
                  onClick={workspace.showGraph}
                >
                  {t('title')}
                </SwitcherButton>
              ) : null}
              {switcherArtifacts.map((artifact, index) => (
                <ArtifactSwitcherButton
                  key={artifact.id}
                  artifact={artifact}
                  current={artifact.id === artifactId}
                  number={index + 1}
                  onClick={() => workspace.open(artifact.id)}
                />
              ))}
            </fieldset>
          ) : null}
          {keepGraph || showingGraph ? (
            <div
              hidden={!showingGraph}
              className="flex min-h-0 flex-1 flex-col"
            >
              <ChatKnowledgeGraphWorkspace chatbotId={chatbotId} onAsk={ask} />
            </div>
          ) : null}
          {artifactId !== null ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-3">
              <ArtifactSlot key={artifactId} artifactId={artifactId} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SwitcherButton({
  current,
  onClick,
  children,
}: {
  current: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={current}
      onClick={onClick}
      className={twMerge(
        'focus-visible:ring-ring min-h-11 shrink-0 rounded-md px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 fine-pointer:min-h-8',
        current ? 'bg-accent font-medium' : 'hover:bg-accent/60'
      )}
    >
      {children}
    </button>
  )
}

function ArtifactSwitcherButton({
  artifact,
  current,
  number,
  onClick,
}: {
  artifact: Artifact
  current: boolean
  number: number
  onClick: () => void
}) {
  const language = useCodeLanguageName(artifact.profile)
  return (
    <SwitcherButton current={current} onClick={onClick}>
      {`${language} ${number}`}
    </SwitcherButton>
  )
}
