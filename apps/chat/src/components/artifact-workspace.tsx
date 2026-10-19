'use client'

import { PanelRightOpenIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
  activeArtifactId,
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

  // Presence must not change identity when the thread or storage target
  // does: a re-run effect would briefly count the anchor as gone and close
  // the workspace view.
  const anchorMounted = useCallback((artifactId: string) => {
    dispatch({ type: 'anchor-mounted', artifactId })
    return () => dispatch({ type: 'anchor-unmounted', artifactId })
  }, [])

  // Registration must not change identity with the scope either: anchors of
  // the previous thread stay mounted for one commit after the scope changes
  // and would register their artifacts into the new scope.
  const targetRef = useRef(target)
  // Layout effects run before the anchors' passive registration effects, so
  // a new anchor always restores against the current target.
  useLayoutEffect(() => {
    targetRef.current = target
  }, [target])
  const register = useCallback((artifact: Artifact) => {
    // Restoring at registration makes the saved edit the first value the
    // card renders, so the starter never overwrites it.
    const restoreTarget = targetRef.current
    const restored =
      restoreTarget && artifact.kind === 'code'
        ? restoreWorkingCode(getTabStorage(), restoreTarget, artifact)
        : null
    if (restored?.failed) dispatch({ type: 'storage-failed' })
    dispatch({ type: 'register', artifact, restoredCode: restored?.code })
  }, [])

  // Stable actions let consumers register from effects without re-running
  // them on every workspace change.
  const actions = useMemo(
    () => ({
      register,
      anchorMounted,
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
    [graphAvailable, containerFor, target, anchorMounted, register]
  )

  const savesWorkingCode = storage !== undefined
  const value = useMemo<ArtifactWorkspaceValue>(
    () => ({
      ...actions,
      state,
      savesWorkingCode,
      graphSwitchable: graphAvailable && graphSwitchable,
      alwaysFullscreen,
    }),
    [
      actions,
      state,
      savesWorkingCode,
      graphAvailable,
      graphSwitchable,
      alwaysFullscreen,
    ]
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

/**
 * An artifact's place in the conversation. It registers the artifact and shows
 * the mounted card here, or a short note while the workspace shows it.
 * Registering never opens the workspace or moves focus. Pass a memoized
 * artifact so registration runs once per artifact.
 */
export function ArtifactAnchor({
  artifact,
  openedNote,
  workspace,
}: {
  artifact: Artifact
  openedNote: string
  workspace: ArtifactWorkspaceValue
}) {
  const t = useTranslations()
  const { register, anchorMounted } = workspace
  const { id } = artifact

  // Presence tells the workspace whether this artifact's branch is visible.
  useLayoutEffect(() => anchorMounted(id), [anchorMounted, id])

  useEffect(() => {
    register(artifact)
  }, [register, artifact])

  if (activeArtifactId(workspace.state.view) !== id) {
    return <ArtifactSlot artifactId={id} />
  }
  return (
    <div
      className="my-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
      data-cy="artifact-opened"
    >
      <PanelRightOpenIcon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{openedNote}</span>
      <button
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        data-cy="artifact-show-here"
        onClick={workspace.close}
        type="button"
      >
        {t('chat.workspace.showHere')}
      </button>
    </div>
  )
}

/**
 * Opens a mounted card in the workspace. Closing the workspace returns focus
 * here through `focusArtifactLauncher`.
 */
export function ArtifactOpenButton({ artifactId }: { artifactId: string }) {
  const t = useTranslations()
  const workspace = useArtifactWorkspace()
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      data-artifact-launcher="true"
      data-cy="artifact-open"
      onClick={() => workspace?.open(artifactId)}
      type="button"
    >
      <PanelRightOpenIcon aria-hidden className="size-3.5" />
      {t('chat.workspace.open')}
    </button>
  )
}
