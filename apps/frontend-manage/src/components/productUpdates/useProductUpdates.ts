import { useProductUpdates as useSharedProductUpdates } from '@klicker-uzh/shared-components/src/productUpdates/useProductUpdates'

export type {
  ProductUpdateEntry,
  ProductUpdateState,
  UseProductUpdatesResult,
} from '@klicker-uzh/shared-components/src/productUpdates/useProductUpdates'

/**
 * The lecturer's product update feed on the manage surface. See the shared
 * hook for the read and write semantics.
 */
export function useProductUpdates() {
  return useSharedProductUpdates({ audience: 'lecturer', surface: 'manage' })
}
