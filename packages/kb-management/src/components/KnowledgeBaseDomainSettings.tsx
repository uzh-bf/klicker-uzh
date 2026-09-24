'use client'

import { useMutation, useQuery } from '@apollo/client'
import {
  GetKbGraphDomainOptionsDocument,
  UpdateKbDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
// biome-ignore lint/correctness/noUnusedImports: this package uses the classic JSX transform.
import React, { useState } from 'react'
import {
  DEFAULT_DOMAIN_GENERATION_LANGUAGE,
  isDomainGenerationLanguage,
  isKbDomainSelectionSupported,
  type KbDomainTriple,
  kbDomainLabelForId,
  suggestedKbDomain,
  useKbDomainLabels,
} from '../kbDomainSettings'
import KnowledgeBaseDomainFields, {
  type KbDomainFieldsValue,
} from './KnowledgeBaseDomainFields'

/**
 * The subject area and language the knowledge base itself carries. Every graph
 * prepared from it starts from this choice, and each build keeps a snapshot of
 * what it ran with, so editing here changes only what the next preparation uses.
 */
function KnowledgeBaseDomainSettings({
  kbId,
  domain,
}: {
  kbId: string
  domain: KbDomainTriple
}) {
  const t = useTranslations()
  const { labelForKey, languageLabel } = useKbDomainLabels()
  const [draft, setDraft] = useState<KbDomainFieldsValue | null>(null)
  const [saveError, setSaveError] = useState(false)
  const { data } = useQuery(GetKbGraphDomainOptionsDocument)
  const [updateKb, { loading: isSaving }] = useMutation(UpdateKbDocument)

  const config = data?.getKbKnowledgeGraphDomainConfig
  const options = config?.capabilityEnabled ? config.options : []
  const editable = options.length > 0
  const hasStoredDomain = domain.id != null

  // A deployment that cannot offer the catalog has nothing to say about a
  // knowledge base that never recorded a choice.
  if (!editable && !hasStoredDomain) return null

  const storedLabel =
    domain.id != null
      ? (kbDomainLabelForId(domain.id, options, labelForKey) ?? domain.id)
      : t('kb.domainSettingsNotSet')
  const storedLanguage =
    domain.language != null
      ? languageLabel(domain.language)
      : t('kb.domainSettingsNotSet')

  const handleEdit = () => {
    setSaveError(false)
    setDraft(
      domain.id != null && domain.language != null
        ? {
            id: domain.id,
            version: domain.version,
            // A stored language the catalog no longer knows would leave the
            // control empty, so the suggestion stands in and the lecturer
            // replaces the pair explicitly.
            language: isDomainGenerationLanguage(domain.language)
              ? domain.language
              : (suggestedKbDomain(options)?.language ??
                DEFAULT_DOMAIN_GENERATION_LANGUAGE),
          }
        : suggestedKbDomain(options)
    )
  }

  const handleSave = async () => {
    if (draft == null || !isKbDomainSelectionSupported(options, draft)) return
    setSaveError(false)
    try {
      await updateKb({
        variables: {
          id: kbId,
          domainPolicyId: draft.id,
          domainPolicyVersion: draft.version,
          domainPolicyLanguage: draft.language,
        },
      })
    } catch (error) {
      console.error('Failed to update knowledge base settings', error)
      setSaveError(true)
      return
    }
    setDraft(null)
  }

  return (
    <section
      className="mt-6"
      aria-labelledby="kb-domain-settings-title"
      data-cy="kb-domain-settings"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="kb-domain-settings-title"
          className="text-lg font-semibold text-slate-900"
        >
          {t('kb.domainSettingsTitle')}
        </h2>
        {editable && draft == null ? (
          <Button onClick={handleEdit} data={{ cy: 'kb-domain-settings-edit' }}>
            <Button.Label>{t('shared.generic.edit')}</Button.Label>
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {t('kb.domainSettingsDescription')}
      </p>
      {draft != null ? (
        <div className="mt-3 space-y-3">
          <KnowledgeBaseDomainFields
            options={options}
            value={draft}
            onChange={setDraft}
            disabled={isSaving}
            dataCyPrefix="kb-domain-settings"
          />
          {saveError ? (
            <UserNotification
              type="error"
              message={t('kb.domainSettingsSaveError')}
              data={{ cy: 'kb-domain-settings-error' }}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!isKbDomainSelectionSupported(options, draft)}
              loading={isSaving}
              onClick={() => void handleSave()}
              data={{ cy: 'kb-domain-settings-save' }}
            >
              <Button.Label>{t('shared.generic.save')}</Button.Label>
            </Button>
            <Button
              disabled={isSaving}
              onClick={() => {
                setSaveError(false)
                setDraft(null)
              }}
              data={{ cy: 'kb-domain-settings-cancel' }}
            >
              <Button.Label>{t('shared.generic.cancel')}</Button.Label>
            </Button>
          </div>
        </div>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-1 border-y border-slate-200 bg-white sm:grid-cols-2">
          <div className="min-w-0 py-3">
            <dt className="text-sm text-slate-600">
              {t('kb.domainSubjectLabel')}
            </dt>
            <dd
              className="mt-1 text-base font-semibold text-slate-900"
              data-cy="kb-domain-settings-subject-value"
            >
              {storedLabel}
            </dd>
          </div>
          <div className="min-w-0 py-3">
            <dt className="text-sm text-slate-600">
              {t('kb.domainLanguageLabel')}
            </dt>
            <dd
              className="mt-1 text-base font-semibold text-slate-900"
              data-cy="kb-domain-settings-language-value"
            >
              {storedLanguage}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}

export default KnowledgeBaseDomainSettings
