'use client'

import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
// biome-ignore lint/correctness/noUnusedImports: this package uses the classic JSX transform.
import React from 'react'
import {
  DOMAIN_GENERATION_LANGUAGES,
  type DomainGenerationLanguage,
  findKbDomainOption,
  isDomainGenerationLanguage,
  type KbDomainOption,
  kbDomainItems,
  kbDomainOptionServesLanguage,
  kbDomainOptionValue,
  useKbDomainLabels,
} from '../kbDomainSettings'

export type KbDomainFieldsValue = {
  id: string
  version: number | null
  language: DomainGenerationLanguage
}

/**
 * The subject area and language controls a lecturer uses on the knowledge base
 * itself, both while creating one and while editing an existing one. The caller
 * owns the value and decides what an unsupported selection blocks, so the same
 * pair of controls serves a creation form with nothing stored yet and an edit
 * form that has to keep showing a selection the catalog has since retired.
 */
function KnowledgeBaseDomainFields({
  options,
  value,
  onChange,
  disabled,
  dataCyPrefix,
}: {
  options: readonly KbDomainOption[]
  value: KbDomainFieldsValue
  onChange: (value: KbDomainFieldsValue) => void
  disabled?: boolean
  dataCyPrefix: string
}) {
  const t = useTranslations()
  const { labelForKey, languageLabel } = useKbDomainLabels()
  // A selection the catalog no longer offers leaves the control empty rather
  // than silently pointing at a neighbouring version.
  const selectedOption = findKbDomainOption(options, value)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label={t('kb.domainSubjectLabel')}
        items={kbDomainItems(options, labelForKey)}
        value={selectedOption ? kbDomainOptionValue(selectedOption) : ''}
        placeholder={t('kb.graphDomainSelectPlaceholder')}
        onChange={(selected) => {
          const option = options.find(
            (candidate) => kbDomainOptionValue(candidate) === selected
          )
          if (!option) return
          // The language is carried over unchanged. A subject that cannot serve
          // it leaves the selection blocked until the lecturer picks a supported
          // language, instead of rewriting a choice they did not revisit.
          onChange({
            id: option.id,
            version: option.version,
            language: value.language,
          })
        }}
        disabled={disabled}
        data={{ cy: `${dataCyPrefix}-subject` }}
        className={{ root: 'w-full', select: { trigger: 'w-full' } }}
      />
      <SelectField
        label={t('kb.domainLanguageLabel')}
        items={DOMAIN_GENERATION_LANGUAGES.map((language) => ({
          value: language,
          label: languageLabel(language),
        }))}
        value={value.language}
        placeholder={t('kb.graphDomainLanguageSelectPlaceholder')}
        onChange={(selected) => {
          if (!isDomainGenerationLanguage(selected)) return
          onChange({ id: value.id, version: value.version, language: selected })
        }}
        disabled={disabled}
        data={{ cy: `${dataCyPrefix}-language` }}
        className={{ root: 'w-full', select: { trigger: 'w-full' } }}
      />
      {selectedOption &&
      !kbDomainOptionServesLanguage(selectedOption, value.language) ? (
        <p
          className="text-sm text-amber-900 sm:col-span-2"
          data-cy={`${dataCyPrefix}-unsupported`}
        >
          {t('kb.domainLanguageUnsupported', {
            domain: labelForKey(selectedOption.labelKey) ?? selectedOption.id,
            language: languageLabel(value.language),
          })}
        </p>
      ) : null}
    </div>
  )
}

export default KnowledgeBaseDomainFields
