import { useManageAiCapability } from '../../components/featureFlags/ManageFeatureFlagProvider'

/**
 * Compatibility boolean for callers that only need to render the fully
 * enabled AI surface. The root Manage capability provider owns the query and
 * keeps temporary GrowthBook failures separate from explicit denial.
 */
export function useAiFeaturesEnabled(): boolean {
  return useManageAiCapability().state === 'enabled'
}
