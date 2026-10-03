/**
 * The server-owned identifier for the knowledge-base material-transfer notice.
 *
 * The identifier names the wording the transferring user confirmed, not a
 * publication date. It covers the two confirmations that precede a material
 * transfer into a knowledge base: the authority to use the material in the
 * knowledge base and in answers, and the absence of personal data beyond
 * ordinary author names and bibliographic details. Publishing wording that
 * changes what is confirmed requires a new identifier, so transfers requested
 * under the previous wording can no longer be confirmed.
 */
export const KB_TRANSFER_ATTESTATION_VERSION = '2026-09-09'

type TransferAttestationState = {
  transferAttestationVersion: string | null
  rightsConfirmedAt: Date | null
  personalDataConfirmedAt: Date | null
}

/**
 * Whether a stored transfer carries both confirmations under the current
 * wording. A reservation made before the notice existed, or under an earlier
 * revision of it, is not current and must not authorize a transfer.
 */
export function isKbTransferAttestationCurrent(
  state: TransferAttestationState | null
) {
  return (
    state !== null &&
    state.transferAttestationVersion === KB_TRANSFER_ATTESTATION_VERSION &&
    state.rightsConfirmedAt !== null &&
    state.personalDataConfirmedAt !== null
  )
}
