export type AdaptiveV2DiagnosticRelease = Readonly<{
  enabled: boolean
  classificationPolicyVersion: number
  validationProtocolVersion: string | null
  approvedProbabilityThreshold: number | null
}>

// Diagnostic classification remains fail-closed until the internal release
// simulation and a versioned empirical protocol approve the same threshold.
export const ADAPTIVE_V2_DIAGNOSTIC_RELEASE: AdaptiveV2DiagnosticRelease =
  Object.freeze({
    enabled: false,
    classificationPolicyVersion: 1,
    validationProtocolVersion: null,
    approvedProbabilityThreshold: null,
  })
