'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  type Artifact,
  type ArtifactWorkspaceState,
  artifactWorkspaceReducer,
  type CodeArtifact,
  getTabStorage,
  initialArtifactWorkspaceState,
  restoreWorkingCode,
  saveWorkingCode,
} from './artifact-workspace-state'

export interface ArtifactWorkspaceValue {
  state: ArtifactWorkspaceState
  /** The switcher offers the knowledge graph; embedded Chat leaves it out. */
  graphSwitchable: boolean
  /** Artifacts always open as a fullscreen dialog, as in an embedded frame. */
  alwaysFullscreen: boolean
  /** Working code is saved in this tab; false for memory-only owner preview. */
  savesWorkingCode: boolean
  register: (artifact: Artifact) => void
  /** Counts a mounted conversation anchor; returns the matching release. */
  anchorMounted: (artifactId: string) => () => void
  open: (artifactId: string) => void
  showGraph: () => void
  close: () => void
  editCode: (artifact: CodeArtifact, code: string) => void
  containerFor: (artifactId: string) => HTMLDivElement
}

const ArtifactWorkspaceContext = createContext<ArtifactWorkspaceValue | null>(
  null
)

/** The workspace of the current page, or null where Chat renders no panel. */
export function useArtifactWorkspace(): ArtifactWorkspaceValue | null {
  return useContext(ArtifactWorkspaceContext)
}

/**
 * Owns the artifacts of one conversation scope and mounts each one exactly
 * once. Every artifact renders into its own detached container, which slots
 * in the conversation and in the workspace adopt. Moving the container keeps
 * the mounted card, so edits, a running attempt and its output survive
 * opening, switching and closing. A changed scope key drops all artifacts.
 * With `storage`, working code is saved per tab under that owner scope.
 */
export function ArtifactWorkspaceProvider({
  children,
  scopeKey,
  storage,
  graphAvailable,
  graphSwitchable,
  graphInitiallyOpen = false,
  alwaysFullscreen = false,
  renderArtifact,
}: {
  children: ReactNode
  scopeKey: string | null
  /** Opaque server-derived owner scope and chatbot; absent keeps edits in memory. */
  storage?: { scope: string; chatbotId: string }
  graphAvailable: boolean
  graphSwitchable: boolean
  graphInitiallyOpen?: boolean
  alwaysFullscreen?: boolean
  renderArtifact: (artifact: Artifact) => ReactNode
}) {
  const [state, dispatch] = useReducer(
    artifactWorkspaceReducer,
    graphAvailable && graphInitiallyOpen,
    (graphOpen): ArtifactWorkspaceState => ({
      ...initialArtifactWorkspaceState,
      view: graphOpen ? 'graph' : null,
    })
  )
  // Containers belong to one scope. A scope change swaps them during render,
  // in the same pass that clears the state, so cards of the new scope can
  // never be wiped by a later effect.
  const [scopeStore, setScopeStore] = useState(() => ({
    scope: scopeKey,
    containers: new Map<string, HTMLDivElement>(),
  }))
  if (scopeStore.scope !== scopeKey) {
    // A thread created for the first message must not drop its own cards.
    if (scopeStore.scope === null) {
      setScopeStore({ ...scopeStore, scope: scopeKey })
    } else {
      setScopeStore({ scope: scopeKey, containers: new Map() })
      dispatch({ type: 'clear' })
    }
  }
  const { containers } = scopeStore

  useEffect(() => {
    if (!graphAvailable && state.view === 'graph') dispatch({ type: 'close' })
  }, [graphAvailable, state.view])

  const containerFor = useCallback(
    (artifactId: string) => {
      let container = containers.get(artifactId)
      if (!container) {
        container = document.createElement('div')
        containers.set(artifactId, container)
      }
      return container
    },
    [containers]
  )

  const storageScope = storage?.scope
  const storageChatbotId = storage?.chatbotId
  const target = useMemo(
    () =>
      storageScope && storageChatbotId && scopeKey
        ? {
            scope: storageScope,
            chatbotId: storageChatbotId,
            threadId: scopeKey,
          }
        : null,
    [storageScope, storageChatbotId, scopeKey]
  )

  // Stable actions let consumers register from effects without re-running
  // them on every workspace change.
  const actions = useMemo(
    () => ({
      register: (artifact: Artifact) => {
        // Restoring at registration makes the saved edit the first value the
        // card renders, so the starter never overwrites it.
        const restored = target
          ? restoreWorkingCode(getTabStorage(), target, artifact)
          : null
        if (restored?.failed) dispatch({ type: 'storage-failed' })
        dispatch({ type: 'register', artifact, restoredCode: restored?.code })
      },
      anchorMounted: (artifactId: string) => {
        dispatch({ type: 'anchor-mounted', artifactId })
        return () => dispatch({ type: 'anchor-unmounted', artifactId })
      },
      open: (artifactId: string) => dispatch({ type: 'open', artifactId }),
      showGraph: () => {
        if (graphAvailable) dispatch({ type: 'show-graph' })
      },
      close: () => dispatch({ type: 'close' }),
      editCode: (artifact: CodeArtifact, code: string) => {
        dispatch({ type: 'edit-code', artifactId: artifact.id, code })
        if (
          target &&
          !saveWorkingCode(getTabStorage(), target, artifact, code)
        ) {
          dispatch({ type: 'storage-failed' })
        }
      },
      containerFor,
    }),
    [graphAvailable, containerFor, target]
  )

  const value = useMemo<ArtifactWorkspaceValue>(
    () => ({
      ...actions,
      state,
      savesWorkingCode: storage !== undefined,
      graphSwitchable: graphAvailable && graphSwitchable,
      alwaysFullscreen,
    }),
    [actions, state, storage, graphAvailable, graphSwitchable, alwaysFullscreen]
  )

  return (
    <ArtifactWorkspaceContext.Provider value={value}>
      {children}
      {state.artifacts.map((artifact) =>
        createPortal(
          renderArtifact(artifact),
          containerFor(artifact.id),
          artifact.id
        )
      )}
    </ArtifactWorkspaceContext.Provider>
  )
}

/**
 * Shows an artifact's mounted card at this place. Render a slot only where
 * the artifact belongs right now; when no slot holds it, the card stays
 * mounted but detached, outside focus and the accessibility tree.
 */
export function ArtifactSlot({
  artifactId,
  className,
}: {
  artifactId: string
  className?: string
}) {
  const containerFor = useArtifactWorkspace()?.containerFor
  const slotRef = useRef<HTMLDivElement>(null)

  // A layout effect attaches the card before paint, after the previous slot's
  // cleanup released it in the same commit. It depends only on stable values:
  // re-attaching on every workspace change would drop the editor's focus.
  useLayoutEffect(() => {
    const slot = slotRef.current
    if (!containerFor || !slot) return
    const container = containerFor(artifactId)
    slot.appendChild(container)
    return () => {
      if (container.parentNode === slot) slot.removeChild(container)
    }
  }, [containerFor, artifactId])

  return <div ref={slotRef} className={className} />
}

/**
 * Returns focus to an artifact's launcher after it moved back into the
 * conversation, once the move has been committed.
 */
export function focusArtifactLauncher(container: HTMLElement) {
  requestAnimationFrame(() => {
    container
      .querySelector<HTMLElement>('[data-artifact-launcher="true"]')
      ?.focus()
  })
}
