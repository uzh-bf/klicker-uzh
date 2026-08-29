// The browser half of the package: everything that touches the DOM, driver.js
// or React lives here, so the pure entry point stays importable from the
// backend. Consuming apps import `driver.js/dist/driver.css` themselves — a
// tsc-built package cannot ship CSS, and pnpm does not hoist the dependency.

import type { Alignment, Driver, DriveStep, Side } from 'driver.js'
import { driver } from 'driver.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { escapeHtml } from './index.js'

// One slot per browser tab for everything the user did not ask for: the
// onboarding tour and the product-update spotlight both claim it, so a lecturer
// never gets two overlays in a row. sessionStorage is per tab and disappears
// with it, which is the closest thing to a session the client can observe
// without another server round trip.
const SESSION_SLOT_KEY = 'klicker-uzh.onboarding.unsolicitedOverlay'

/**
 * Whether this tab has already shown an unsolicited overlay.
 *
 * Storage can be unavailable, for instance when the browser blocks it for this
 * origin. The cap cannot be honoured without it, and an uncapped overlay is
 * worse than a missing one, so the slot then counts as taken.
 */
export function unsolicitedOverlayShownThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_SLOT_KEY) === 'true'
  } catch {
    return true
  }
}

/**
 * Takes the tab's single unsolicited-overlay slot. Callers claim it before the
 * overlay opens, so a presentation that fails halfway does not hand the slot to
 * the next candidate in the same page load.
 */
export function claimUnsolicitedOverlaySlot() {
  try {
    window.sessionStorage.setItem(SESSION_SLOT_KEY, 'true')
  } catch {
    // See above: a session that cannot remember never presents again anyway.
  }
}

/**
 * Opens an overlay one animation frame later and returns the matching cancel.
 *
 * Deferring protects against a mount that is undone straight away — React's
 * development double-invocation, or a layout that flips back to its loading
 * state — which would otherwise burn the session slot on an overlay that is
 * torn down again immediately. It also lets a modal that triggered the overlay
 * finish unmounting, so its focus trap does not fight the popover.
 */
export function deferToNextFrame(open: () => void): () => void {
  const frame = requestAnimationFrame(open)

  return () => cancelAnimationFrame(frame)
}

export interface FeatureTargetRegistry<Key extends string> {
  /** Spread onto the element the key names, or onto a wrapper around it. */
  targetProps: (key: Key) => Record<string, string>
  /** The element on the current page, or null when it is not rendered here. */
  resolve: (key: string | undefined) => HTMLElement | null
}

/**
 * Builds an app's registry of UI elements that overlays may point at.
 *
 * Elements are named by key and found through a data attribute, never through a
 * CSS selector: a selector stored outside the component breaks silently the
 * next time the markup moves, and nobody notices until a user sees an overlay
 * around nothing. Each app owns its own attribute and key set, because the same
 * key would mean different things in the lecturer and student interfaces.
 */
export function createFeatureTargetRegistry<Key extends string>({
  attribute,
  targets,
}: {
  attribute: string
  targets: Record<Key, string>
}): FeatureTargetRegistry<Key> {
  return {
    targetProps: (key) => ({ [attribute]: key }),

    resolve: (key) => {
      // An unknown key is a normal outcome: the caller can be newer than this
      // build. So is a known key that this page does not render.
      if (key === undefined || !(key in targets)) return null

      return document.querySelector<HTMLElement>(`[${attribute}="${key}"]`)
    },
  }
}

export type ProductTourEndReason = 'complete' | 'skip' | 'dismiss'

export interface ProductTourStep {
  /**
   * Resolved when the tour starts. A step whose element is not on the page is
   * left out; a step without an element at all is shown centered, which is how
   * a tour opens with a welcome card.
   */
  element?: () => HTMLElement | null
  title: string
  description: string
  side?: Side
  align?: Alignment
}

export interface ProductTourLabels {
  next: string
  previous: string
  done: string
  /** Carries driver.js' `{{current}}` and `{{total}}` markers. */
  progress: string
}

export interface UseProductTourOptions {
  steps: ProductTourStep[]
  labels: ProductTourLabels
  /**
   * Whether the actor still needs the unsolicited run. `null` means the answer
   * is not known yet — usually because the stored tour state is still loading.
   * Nothing starts and nothing settles while it is null, so a failed state
   * query never turns into a tour for someone who already finished it.
   */
  autoStart: boolean | null
  /** Set on routes where an overlay would interrupt time-critical work. */
  autoStartSuppressed?: boolean
  onComplete?: () => void
  onSkip?: () => void
  onDismiss?: () => void
}

export interface UseProductTourResult {
  /** Starts the tour on explicit request, ignoring every cap. */
  startTour: () => void
  /**
   * True once the auto-start decision has been made and acted on. Other
   * unsolicited overlays wait for this before claiming the session slot, so the
   * tour wins deterministically on an account that has never seen it.
   */
  autoStartSettled: boolean
}

/**
 * Runs a multi-step driver.js tour over elements the caller names.
 *
 * The hook owns the overlay mechanics — step assembly, escaping, the session
 * slot, and the deferred open — while the caller owns the policy: which steps
 * exist, in which language, whether this actor is still eligible, and what
 * "finished" means for the surface. Ending the tour in any way is reported
 * exactly once, because every surface stores completion the same way.
 */
export function useProductTour({
  steps,
  labels,
  autoStart,
  autoStartSuppressed = false,
  onComplete,
  onSkip,
  onDismiss,
}: UseProductTourOptions): UseProductTourResult {
  // Steps and labels are rebuilt on every render of a translated component, so
  // the running tour reads them through a ref instead of restarting whenever
  // their identity changes.
  const latest = useRef({ steps, labels, onComplete, onSkip, onDismiss })
  useEffect(() => {
    latest.current = { steps, labels, onComplete, onSkip, onDismiss }
  })

  const activeDriver = useRef<Driver | null>(null)
  const endReason = useRef<ProductTourEndReason | null>(null)
  // A teardown the user did not ask for — an unmount, or a replay replacing a
  // running tour — must not be reported as an ending.
  const silentTeardown = useRef(false)
  const autoStarted = useRef(false)
  const [pendingStart, setPendingStart] = useState(false)
  const [autoStartSettled, setAutoStartSettled] = useState(false)

  // Returns whether the tour actually opened: a tour whose targets are all
  // missing shows nothing, and the caller must not treat that as a run.
  const start = useCallback((): boolean => {
    const current = latest.current

    const driverSteps: DriveStep[] = []
    for (const step of current.steps) {
      const element = step.element?.()
      if (step.element && !element) continue

      driverSteps.push({
        element: element ?? undefined,
        popover: {
          // Driver.js writes every popover string into the DOM with innerHTML.
          title: escapeHtml(step.title),
          description: escapeHtml(step.description),
          side: step.side,
          align: step.align,
        },
      })
    }

    if (driverSteps.length === 0) return false

    if (activeDriver.current) {
      silentTeardown.current = true
      activeDriver.current.destroy()
    }

    // A previous teardown may have left the flag raised — React's development
    // double mount runs the unmount cleanup on the same refs the remounted hook
    // keeps using. A tour that is starting now always reports how it ends.
    silentTeardown.current = false

    const instance = driver({
      steps: driverSteps,
      allowClose: true,
      stagePadding: 6,
      showProgress: driverSteps.length > 1,
      progressText: escapeHtml(current.labels.progress),
      nextBtnText: escapeHtml(current.labels.next),
      prevBtnText: escapeHtml(current.labels.previous),
      doneBtnText: escapeHtml(current.labels.done),
      // Driver.js only calls these instead of its own teardown, so each one has
      // to destroy the overlay itself. They exist to tell the three endings
      // apart; the state they leave behind is the same for all of them.
      onDoneClick: () => {
        endReason.current = 'complete'
        instance.destroy()
      },
      onCloseClick: () => {
        endReason.current = 'skip'
        instance.destroy()
      },
      // Reached by every ending, including the ones with no button behind them:
      // the escape key and a click on the overlay.
      onDestroyed: () => {
        activeDriver.current = null
        const reason = endReason.current ?? 'dismiss'
        endReason.current = null

        if (silentTeardown.current) return

        const handlers = latest.current
        if (reason === 'complete') handlers.onComplete?.()
        else if (reason === 'skip') handlers.onSkip?.()
        else handlers.onDismiss?.()
      },
    })

    activeDriver.current = instance
    instance.drive()

    return true
  }, [])

  useEffect(() => {
    if (autoStartSettled || autoStarted.current) return
    // Eligibility unknown: stay unsettled so that overlays waiting on the tour
    // keep waiting instead of presenting themselves first.
    if (autoStart === null) return

    if (!autoStart || autoStartSuppressed) {
      setAutoStartSettled(true)
      return
    }

    if (unsolicitedOverlayShownThisSession()) {
      setAutoStartSettled(true)
      return
    }

    return deferToNextFrame(() => {
      // A tour is already on screen: someone asked for a replay before the
      // stored eligibility arrived, and the answer turned out to be "never
      // seen it". Starting now would tear that running tour down and reopen it
      // at step one, in the middle of the walk the actor is already taking.
      if (activeDriver.current) {
        setAutoStartSettled(true)
        return
      }

      autoStarted.current = true

      // The slot is only spent on a tour that opened. A tour whose targets are
      // missing leaves it to the next candidate rather than silently costing
      // the session its single overlay.
      if (start()) claimUnsolicitedOverlaySlot()

      setAutoStartSettled(true)
    })
  }, [autoStart, autoStartSuppressed, autoStartSettled, start])

  useEffect(() => {
    if (!pendingStart) return

    return deferToNextFrame(() => {
      start()
      setPendingStart(false)
    })
  }, [pendingStart, start])

  useEffect(
    () => () => {
      silentTeardown.current = true
      activeDriver.current?.destroy()
    },
    []
  )

  return {
    startTour: useCallback(() => setPendingStart(true), []),
    autoStartSettled,
  }
}
