import { useMutation } from '@apollo/client'
import { SubmitVideoSourceDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, TextField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { type FormEvent, useState } from 'react'
import { refreshAfterMutation } from '../refreshAfterMutation'

function isWebUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// A KB owner names the recordings (OLAT course node or MediaSpace channel)
// and the course in the course directory. An admin verifies that the two
// belong together; then the course's lecturers are asked for approval.
function KnowledgeBaseVideoSourceForm({
  kbId,
  onSubmitted,
}: {
  kbId: string
  onSubmitted: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [directoryUrl, setDirectoryUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submit, { loading }] = useMutation(SubmitVideoSourceDocument)

  const valid =
    Boolean(name.trim()) &&
    isWebUrl(sourceUrl.trim()) &&
    isWebUrl(directoryUrl.trim())

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid || loading) return
    setError(null)
    try {
      await submit({
        variables: {
          kbId,
          name: name.trim(),
          sourceUrl: sourceUrl.trim(),
          directoryUrl: directoryUrl.trim(),
        },
      })
    } catch (err) {
      // Provider messages for unknown links are written for this person.
      setError((err as Error).message || t('kb.videoSubmitError'))
      return
    }
    await refreshAfterMutation(onSubmitted, 'KB video sources after submit')
    toast({ type: 'success', message: t('kb.videoSubmitted') })
  }

  return (
    <div data-cy="kb-video-form">
      <p className="mt-1 text-sm text-slate-600">{t('kb.videoDescription')}</p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <TextField
          id="kb-video-name"
          autoComplete="off"
          value={name}
          onChange={setName}
          label={t('kb.videoNameLabel')}
          placeholder={t('kb.videoNamePlaceholder')}
          required
          disabled={loading}
          data={{ cy: 'kb-video-name' }}
        />
        <TextField
          id="kb-video-source-url"
          autoComplete="off"
          spellCheck={false}
          type="url"
          value={sourceUrl}
          onChange={setSourceUrl}
          label={t('kb.videoSourceUrlLabel')}
          placeholder="https://"
          required
          disabled={loading}
          data={{ cy: 'kb-video-source-url' }}
        />
        <TextField
          id="kb-video-directory-url"
          autoComplete="off"
          spellCheck={false}
          type="url"
          value={directoryUrl}
          onChange={setDirectoryUrl}
          label={t('kb.videoDirectoryUrlLabel')}
          placeholder="https://"
          required
          disabled={loading}
          data={{ cy: 'kb-video-directory-url' }}
        />
        <p className="text-xs text-slate-600">{t('kb.videoNextSteps')}</p>
        {error ? (
          <p
            role="alert"
            className="text-sm text-red-700"
            data-cy="kb-video-error"
          >
            {error}
          </p>
        ) : null}
        <Button
          primary
          type="submit"
          loading={loading}
          disabled={!valid || loading}
          data={{ cy: 'submit-kb-video-source' }}
        >
          <Button.Label>{t('kb.videoSubmit')}</Button.Label>
        </Button>
      </form>
    </div>
  )
}

export default KnowledgeBaseVideoSourceForm
