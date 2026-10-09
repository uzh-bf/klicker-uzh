import { KB_TRANSFER_ATTESTATION_VERSION } from '@klicker-uzh/util/knowledge-transfer-attestation'
import { Checkbox } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useId } from 'react'

export type KbTransferAttestation = {
  rightsConfirmed: boolean
  personalDataConfirmed: boolean
}

export const EMPTY_KB_TRANSFER_ATTESTATION: KbTransferAttestation = {
  rightsConfirmed: false,
  personalDataConfirmed: false,
}

export function isKbTransferAttestationGiven(
  attestation: KbTransferAttestation
) {
  return attestation.rightsConfirmed && attestation.personalDataConfirmed
}

/**
 * The two confirmations that precede any transfer of material into a knowledge
 * base, in the wording identified by KB_TRANSFER_ATTESTATION_VERSION. Both start
 * unchecked and are given again whenever the material or the knowledge base
 * context changes.
 */
function KnowledgeBaseMaterialConfirmation({
  attestation,
  onChange,
  disabled = false,
}: {
  attestation: KbTransferAttestation
  onChange: (attestation: KbTransferAttestation) => void
  disabled?: boolean
}) {
  const t = useTranslations()
  const idPrefix = useId()
  const descriptionId = idPrefix + '-description'
  const rightsId = idPrefix + '-rights'
  const personalDataId = idPrefix + '-personal-data'

  return (
    <fieldset
      className="mt-4 space-y-3 rounded-md border border-slate-200 p-4"
      disabled={disabled}
      aria-describedby={descriptionId}
      data-cy="kb-material-confirmation"
      data-attestation-version={KB_TRANSFER_ATTESTATION_VERSION}
    >
      <legend className="px-1 text-sm font-semibold text-slate-900">
        {t('kb.materialConfirmationTitle')}
      </legend>
      <p id={descriptionId} className="text-sm text-slate-600">
        {t('kb.materialConfirmationDescription')}
      </p>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id={rightsId}
            checked={attestation.rightsConfirmed}
            disabled={disabled}
            onCheck={() =>
              onChange({
                ...attestation,
                rightsConfirmed: !attestation.rightsConfirmed,
              })
            }
            data={{ cy: 'kb-rights-confirmation' }}
          />
          <label
            htmlFor={rightsId}
            className="cursor-pointer text-sm leading-5 text-slate-700"
          >
            {t('kb.rightsConfirmation')}
          </label>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id={personalDataId}
            checked={attestation.personalDataConfirmed}
            disabled={disabled}
            onCheck={() =>
              onChange({
                ...attestation,
                personalDataConfirmed: !attestation.personalDataConfirmed,
              })
            }
            data={{ cy: 'kb-personal-data-confirmation' }}
          />
          <label
            htmlFor={personalDataId}
            className="cursor-pointer text-sm leading-5 text-slate-700"
          >
            {t('kb.personalDataConfirmation')}
          </label>
        </div>
      </div>
    </fieldset>
  )
}

export default KnowledgeBaseMaterialConfirmation
