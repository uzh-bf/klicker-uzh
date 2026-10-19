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
} from 'react'
import { createPortal } from 'react-dom'
import {
  type Artifact,
  type ArtifactWorkspaceState,
  artifactWorkspaceReducer,
  initialArtifactWorkspaceState,
} from './artifact-workspace-state'

interface ArtifactWorkspaceValue {
  state: ArtifactWorkspaceState
  /** The knowledge graph can be shown in this workspace. */
  graphAvailable: boolean
  /** The switcher offers the knowledge graph; embedded Chat leaves it out. */
  graphSwitchable: boolean
  /** Artifacts always open as a fullscreen dialog, as in an embedded frame. */
  alwaysFullscreen: boolean
  register: (artifact: Artifact) => void
  open: (artifactId: string) => void
  showGraph: () => void
  close: () => void
  editCode: (artifactId: string, code: string) => void
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
 */
export function ArtifactWorkspaceProvider({
  children,
  scopeKey,
  graphAvailable,
  graphSwitchable,
  graphInitiallyOpen = false,
  alwaysFullscreen = false,
  renderArtifact,
}: {
  children: ReactNode
  scopeKey: string | null
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
  const containers = useRef(new Map<string, HTMLDivElement>())
  const previousScope = useRef(scopeKey)

  useEffect(() => {
    // A thread created for the first message must not drop its own cards.
    if (previousScope.current !== null && previousScope.current !== scopeKey) {
      dispatch({ type: 'clear' })
      containers.current.clear()
    }
    previousScope.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    if (!graphAvailable && state.view === 'graph') dispatch({ type: 'close' })
  }, [graphAvailable, state.view])

  const containerFor = useCallback((artifactId: string) => {
    let container = containers.current.get(artifactId)
    if (!container) {
      container = document.createElement('div')
      containers.current.set(artifactId, container)
    }
    return container
  }, [])

  // Stable actions let consumers register from effects without re-running
  // them on every workspace change.
  const actions = useMemo(
    () => ({
      register: (artifact: Artifact) =>
        dispatch({ type: 'register', artifact }),
      open: (artifactId: string) => dispatch({ type: 'open', artifactId }),
      showGraph: () => {
        if (graphAvailable) dispatch({ type: 'show-graph' })
      },
      close: () => dispatch({ type: 'close' }),
      editCode: (artifactId: string, code: string) =>
        dispatch({ type: 'edit-code', artifactId, code }),
      containerFor,
    }),
    [graphAvailable, containerFor]
  )

  const value = useMemo<ArtifactWorkspaceValue>(
    () => ({
      ...actions,
      state,
      graphAvailable,
      graphSwitchable: graphAvailable && graphSwitchable,
      alwaysFullscreen,
    }),
    [actions, state, graphAvailable, graphSwitchable, alwaysFullscreen]
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
