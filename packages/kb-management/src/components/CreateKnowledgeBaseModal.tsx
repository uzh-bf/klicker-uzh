import { useMutation, useQuery } from '@apollo/client'
import {
  CreateKbDocument,
  GetKbGraphDomainOptionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, TextareaField, TextField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import {
  isKbDomainSelectionSupported,
  suggestedKbDomain,
} from '../kbDomainSettings'
import { refreshAfterMutation } from '../refreshAfterMutation'
import KnowledgeBaseDomainFields, {
  type KbDomainFieldsValue,
} from './KnowledgeBaseDomainFields'

function CreateKnowledgeBaseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (kb: { id: string }) => Promise<unknown>
}) {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [domain, setDomain] = useState<KbDomainFieldsValue | null>(null)
  const [createKb, { loading: creating }] = useMutation(CreateKbDocument)
  // The caller's follow-up (for example connecting the new knowledge base to a
  // chatbot) runs after the create mutation settles, so the form stays busy
  // until it finishes and cannot submit a second knowledge base.
  const [finishing, setFinishing] = useState(false)
  const loading = creating || finishing
  const { data: domainData } = useQuery(GetKbGraphDomainOptionsDocument)

  const domainConfig = domainData?.getKbKnowledgeGraphDomainConfig
  // A closed capability gate rejects an explicit selection outright, so the
  // controls stay away and the knowledge base is created without one.
  const domainOptions = domainConfig?.capabilityEnabled
    ? domainConfig.options
    : []
  const domainSelectable = domainOptions.length > 0
  // The suggestion stands in until the lecturer touches a control, so the form
  // opens on a usable pair without an effect that could race the catalog query.
  const domainValue = domain ?? suggestedKbDomain(domainOptions)
  const domainSupported =
    domainValue != null &&
    isKbDomainSelectionSupported(domainOptions, domainValue)
  const canCreate =
    name.trim().length > 0 && (!domainSelectable || domainSupported)

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!canCreate || loading) return

    let created: { id: string } | undefined
    try {
      const result = await createKb({
        variables: {
          name: trimmedName,
          description: description.trim() || null,
          // Only an accepted, serviceable selection is sent. Everything else
          // leaves the columns empty, which means "no explicit selection" and
          // keeps the provider default in charge of the first build.
          domainPolicyId: domainSupported ? domainValue.id : null,
          domainPolicyVersion: domainSupported ? domainValue.version : null,
          domainPolicyLanguage: domainSupported ? domainValue.language : null,
        },
      })
      created = result.data?.createKb
    } catch (error) {
      console.error('Failed to create knowledge base', error)
      toast({ type: 'error', message: t('kb.createError') })
      return
    }

    if (!created) {
      toast({ type: 'error', message: t('kb.createError') })
      return
    }

    const createdKb = created
    setFinishing(true)
    await refreshAfterMutation(
      () => onCreated(createdKb),
      'knowledge bases after creation'
    )
    setFinishing(false)
    toast({ type: 'success', message: t('kb.createSuccess') })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('kb.create')}
      primaryLabel={t('shared.generic.create')}
      primaryDisabled={!canCreate}
      primaryLoading={loading}
      onPrimaryAction={handleCreate}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataContent={{ cy: 'create-knowledge-base-modal' }}
      dataCloseButton={{ cy: 'close-create-knowledge-base' }}
      dataPrimaryAction={{ cy: 'submit-create-knowledge-base' }}
      dataSecondaryAction={{ cy: 'cancel-create-knowledge-base' }}
      className={{ content: 'max-w-xl' }}
    >
      <div className="space-y-4">
        <TextField
          id="knowledge-base-name"
          autoComplete="off"
          value={name}
          onChange={setName}
          label={t('kb.nameLabel')}
          required
          disabled={loading}
          onEnter={handleCreate}
          data={{ cy: 'knowledge-base-name' }}
        />
        <TextareaField
          id="knowledge-base-description"
          autoComplete="off"
          value={description}
          onChange={setDescription}
          label={t('kb.descriptionLabel')}
          disabled={loading}
          rows={4}
          data={{ cy: 'knowledge-base-description' }}
        />
        {domainSelectable && domainValue != null ? (
          <div data-cy="knowledge-base-domain-fields">
            <KnowledgeBaseDomainFields
              options={domainOptions}
              value={domainValue}
              onChange={setDomain}
              disabled={loading}
              dataCyPrefix="knowledge-base-domain"
            />
            <p className="mt-2 text-xs text-slate-500">
              {t('kb.domainSettingsDescription')}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export default CreateKnowledgeBaseModal
