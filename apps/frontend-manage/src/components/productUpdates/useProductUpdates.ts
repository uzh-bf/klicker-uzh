import { type ApolloCache, useMutation, useQuery } from '@apollo/client'
import type { FeatureFlagKey } from '@klicker-uzh/feature-flags'
import { useFeatureFlags } from '@klicker-uzh/feature-flags/react'
import {
  DismissProductUpdateDocument,
  MarkProductUpdateReadDocument,
  ProductUpdateStatesDocument,
  type ProductUpdateStatesQuery,
  RecordProductUpdatePresentationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  PRODUCT_UPDATES,
  type ProductUpdate,
  selectEligibleUpdates,
} from '@klicker-uzh/product-updates'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { trackProductUpdateEligibility } from './tracking'

export type ProductUpdateState =
  ProductUpdateStatesQuery['productUpdateStates'][number]

export type ProductUpdateEntry = {
  update: ProductUpdate
  // Absent while the actor has never interacted with the entry: the backend
  // only stores a row once a presentation, read, or dismissal was reported.
  state?: ProductUpdateState
  unread: boolean
  dismissed: boolean
}

// Only the flags the catalog actually gates on are evaluated, in one hook call
// so that a growing catalog never changes the number of hooks per render.
const CATALOG_FLAG_KEYS: FeatureFlagKey[] = Array.from(
  new Set(
    PRODUCT_UPDATES.flatMap((update) => update.requiredFeatureFlags ?? [])
  )
)

export type UseProductUpdatesResult = {
  entries: ProductUpdateEntry[]
  unreadCount: number
  loading: boolean
  // True once the stored states are known to be complete. A failed query
  // resolves with no rows, which is indistinguishable from "this actor has
  // never seen anything", so every decision that depends on a stored state has
  // to wait for this rather than for `loading` alone.
  statesLoaded: boolean
  recordPresentation: (updateId: string) => void
  markRead: (updateId: string) => void
  dismiss: (updateId: string) => void
}

/**
 * Reads the lecturer's product update feed: the catalog entries that may be
 * shown on the manage surface right now, each paired with the actor's stored
 * read state, plus the write calls that record what happened to a card.
 *
 * Safe to use from several components at once — they share one Apollo query and
 * the mutations write their result back into that query's cache entry.
 */
export function useProductUpdates(): UseProductUpdatesResult {
  const flags = useFeatureFlags(CATALOG_FLAG_KEYS)

  // A single evaluation instant per mount keeps the eligible set from changing
  // between two renders of the same feed while the actor is reading it.
  const [now] = useState(() => new Date())

  const eligibleUpdates = selectEligibleUpdates({
    updates: PRODUCT_UPDATES,
    audience: 'lecturer',
    surface: 'manage',
    flags,
    now,
  })

  // The eligible ids are the query variables, so they must be referentially
  // stable across renders that did not change the eligible set.
  const eligibleIdsKey = eligibleUpdates.map((update) => update.id).join(',')
  const updateIds = useMemo(
    () => (eligibleIdsKey === '' ? [] : eligibleIdsKey.split(',')),
    [eligibleIdsKey]
  )

  useEffect(() => {
    trackProductUpdateEligibility(updateIds)
  }, [updateIds])

  const { data, loading, error } = useQuery(ProductUpdateStatesDocument, {
    variables: { updateIds },
    skip: updateIds.length === 0,
    // The feed is cookie-scoped and must never be server-rendered into a page
    // that another actor could receive from a cache.
    ssr: false,
  })

  const cacheState = useCallback(
    (cache: ApolloCache<unknown>, state: ProductUpdateState) => {
      cache.updateQuery(
        { query: ProductUpdateStatesDocument, variables: { updateIds } },
        (existing) => {
          const cached = (existing?.productUpdateStates ?? []).find(
            (entry) => entry.updateId === state.updateId
          )

          // A card reports its first presentation and its read at the same
          // moment, and the two writes may be answered out of order. An answer
          // that was computed before the read must not hand back a row that
          // drops the read or dismissal the other answer already delivered.
          const merged = {
            ...state,
            readAt: state.readAt ?? cached?.readAt ?? null,
            dismissedAt: state.dismissedAt ?? cached?.dismissedAt ?? null,
          }

          return {
            productUpdateStates: [
              ...(existing?.productUpdateStates ?? []).filter(
                (entry) => entry.updateId !== state.updateId
              ),
              merged,
            ],
          }
        }
      )
    },
    [updateIds]
  )

  const [recordPresentationMutation] = useMutation(
    RecordProductUpdatePresentationDocument
  )
  const [markReadMutation] = useMutation(MarkProductUpdateReadDocument)
  const [dismissMutation] = useMutation(DismissProductUpdateDocument)

  const recordPresentation = useCallback(
    (updateId: string) => {
      void recordPresentationMutation({
        variables: { updateId },
        update: (cache, result) => {
          if (result.data) {
            cacheState(cache, result.data.recordProductUpdatePresentation)
          }
        },
        // Read state is a convenience, never a gate: a rejected write (a
        // read-only delegated session, for instance) must not break the feed.
        onError: () => {},
      })
    },
    [cacheState, recordPresentationMutation]
  )

  const markRead = useCallback(
    (updateId: string) => {
      void markReadMutation({
        variables: { updateId },
        update: (cache, result) => {
          if (result.data) {
            cacheState(cache, result.data.markProductUpdateRead)
          }
        },
        onError: () => {},
      })
    },
    [cacheState, markReadMutation]
  )

  const dismiss = useCallback(
    (updateId: string) => {
      void dismissMutation({
        variables: { updateId },
        update: (cache, result) => {
          if (result.data) {
            cacheState(cache, result.data.dismissProductUpdate)
          }
        },
        onError: () => {},
      })
    },
    [cacheState, dismissMutation]
  )

  const statesByUpdateId = useMemo(
    () =>
      new Map(
        (data?.productUpdateStates ?? []).map((state) => [
          state.updateId,
          state,
        ])
      ),
    [data]
  )

  const entries = eligibleUpdates.map((update) => {
    const state = statesByUpdateId.get(update.id)

    return {
      update,
      state,
      unread: !state?.readAt && !state?.dismissedAt,
      dismissed: Boolean(state?.dismissedAt),
    }
  })

  return {
    entries,
    // Nothing is known to be unread while the stored states are still on their
    // way, so the header dot stays quiet instead of flashing on every cold load.
    unreadCount: loading ? 0 : entries.filter((entry) => entry.unread).length,
    loading,
    statesLoaded: !loading && !error,
    recordPresentation,
    markRead,
    dismiss,
  }
}
