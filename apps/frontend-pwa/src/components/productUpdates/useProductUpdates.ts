import { useProductUpdates as useSharedProductUpdates } from '@klicker-uzh/shared-components/src/productUpdates/useProductUpdates'

export type {
  ProductUpdateEntry,
  ProductUpdateState,
  UseProductUpdatesResult,
} from '@klicker-uzh/shared-components/src/productUpdates/useProductUpdates'

const IS_ASSESSMENT = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'

/**
 * The student's product update feed on the PWA surface. `enabled` is the
 * layout's suppression decision for the excluded actors of the subsystem; see
 * the shared hook for the read and write semantics.
 */
export function useProductUpdates({ enabled }: { enabled: boolean }) {
  return useSharedProductUpdates({
    audience: 'student',
    surface: 'pwa',
    enabled,
    isAssessment: IS_ASSESSMENT,
  })
}
