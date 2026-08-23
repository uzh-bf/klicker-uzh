/**
 * Platform-governed Provider Profile manifests.
 *
 * A profile is policy, not lecturer configuration: it fixes the provider kind,
 * the single approved endpoint alias, the deployment aliases Klicker may
 * expose, the pricing source used for cost estimates, and the factual
 * data-boundary fields rendered into the provider notice. Lecturers can never
 * supply endpoints or add aliases.
 *
 * This manifest intentionally carries no credentials and no raw endpoint URLs;
 * the alias resolves to the fixed origin inside the AI Credential Gateway and
 * BYOK LiteLLM configuration.
 */

export type ProviderProfileManifest = {
  /** Stable platform key stored on the ProviderProfile row. */
  key: string
  /** Bumped when any policy fact below changes materially. */
  version: number
  providerKind: string
  /** Fixed gateway-side alias; never a user-supplied URL. */
  endpointAlias: string
  /** Deployment aliases eligible for named-model bindings. */
  deploymentAliases: string[]
  /** Set only when every Auto target is validated under one credential. */
  autoManifestVersion: string | null
  pricingSource: string
  /** ISO 4217 currency for estimated costs shown to users. */
  currency: string
  /**
   * Factual data-processing boundary statements copied verbatim into the
   * provider notice. No marketing language, no consent claims.
   */
  dataBoundary: string[]
  /** Version of the provider notice derived from this profile. */
  noticeVersion: number
}

export const PROVIDER_PROFILE_MANIFESTS: readonly ProviderProfileManifest[] = [
  {
    key: 'uzh-azure-openai',
    version: 1,
    providerKind: 'azure_openai',
    endpointAlias: 'uzh-azure-openai-eu',
    deploymentAliases: ['gpt-5.6-luna'],
    autoManifestVersion: null,
    pricingSource: 'litellm-model-cost-map',
    currency: 'CHF',
    dataBoundary: [
      'Requests are processed in the UZH-managed Azure environment located in the European Union.',
      'Prompts and responses are retained in Langfuse for 180 days for quality monitoring.',
    ],
    noticeVersion: 1,
  },
] as const

export function getProviderProfileManifest(
  key: string
): ProviderProfileManifest | undefined {
  return PROVIDER_PROFILE_MANIFESTS.find((profile) => profile.key === key)
}
