import { useMutation } from '@apollo/client'
import {
  CreateKbUrlResourceDocument,
  GetKbDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, TextField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { type FormEvent, useState } from 'react'

function isValidWebUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function KnowledgeBaseUrlForm({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [createUrlResource, { loading }] = useMutation(
    CreateKbUrlResourceDocument
  )
  const valid = Boolean(title.trim()) && isValidWebUrl(url.trim())

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid || loading) return

    try {
      await createUrlResource({
        variables: { kbId, title: title.trim(), url: url.trim() },
        refetchQueries: [{ query: GetKbDocument, variables: { id: kbId } }],
        awaitRefetchQueries: true,
      })
      setTitle('')
      setUrl('')
      toast({ type: 'success', message: t('kb.linkSuccess') })
    } catch (error) {
      console.error('Failed to create KB URL resource', error)
      toast({ type: 'error', message: t('kb.linkError') })
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <H3>{t('kb.linkTitle')}</H3>
      <p className="mt-1 text-sm text-slate-600">{t('kb.linkDescription')}</p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <TextField
          id="kb-url-title"
          value={title}
          onChange={setTitle}
          label={t('kb.resourceTitleLabel')}
          required
          disabled={loading}
          data={{ cy: 'kb-url-title' }}
        />
        <TextField
          id="kb-url"
          value={url}
          onChange={setUrl}
          label={t('kb.urlLabel')}
          placeholder="https://"
          type="url"
          required
          disabled={loading}
          data={{ cy: 'kb-url' }}
        />
        <Button
          primary
          type="submit"
          loading={loading}
          disabled={!valid}
          data={{ cy: 'add-kb-url-resource' }}
        >
          <Button.Label>{t('kb.linkTitle')}</Button.Label>
        </Button>
      </form>
    </section>
  )
}

export default KnowledgeBaseUrlForm
