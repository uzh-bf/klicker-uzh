import { useMutation } from '@apollo/client'
import { CreateKbDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal, TextareaField, TextField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'

function CreateKnowledgeBaseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [createKb, { loading }] = useMutation(CreateKbDocument)

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName || loading) return

    try {
      await createKb({
        variables: {
          name: trimmedName,
          description: description.trim() || null,
        },
      })
      await onCreated()
      toast({ type: 'success', message: t('kb.createSuccess') })
      onClose()
    } catch (error) {
      console.error('Failed to create knowledge base', error)
      toast({ type: 'error', message: t('kb.createError') })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('kb.create')}
      primaryLabel={t('shared.generic.create')}
      primaryDisabled={!name.trim()}
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
      </div>
    </Modal>
  )
}

export default CreateKnowledgeBaseModal
