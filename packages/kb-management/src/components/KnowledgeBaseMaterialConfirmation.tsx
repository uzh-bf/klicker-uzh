/** @jsxRuntime automatic */

import { Checkbox } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { ReactElement } from 'react'
import { useId } from 'react'

export const KB_MATERIAL_NOTICE_VERSION = '2026-09-09'

type KnowledgeBaseMaterialConfirmationProps = {
  rightsConfirmed: boolean
  personalDataConfirmed: boolean
  onRightsChange: (confirmed: boolean) => void
  onPersonalDataChange: (confirmed: boolean) => void
  disabled?: boolean
}

function KnowledgeBaseMaterialConfirmation({
  rightsConfirmed,
  personalDataConfirmed,
  onRightsChange,
  onPersonalDataChange,
  disabled = false,
}: KnowledgeBaseMaterialConfirmationProps): ReactElement {
  const t = useTranslations()
  const idPrefix = useId()
  const descriptionId = `${idPrefix}-description`
  const rightsId = `${idPrefix}-rights`
  const personalDataId = `${idPrefix}-personal-data`

  return (
    <fieldset
      className="mt-4 space-y-3 rounded-md border border-slate-200 p-4"
      disabled={disabled}
      aria-describedby={descriptionId}
      data-cy="kb-material-confirmation"
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
            checked={rightsConfirmed}
            disabled={disabled}
            onCheck={() => onRightsChange(!rightsConfirmed)}
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
            checked={personalDataConfirmed}
            disabled={disabled}
            onCheck={() => onPersonalDataChange(!personalDataConfirmed)}
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
