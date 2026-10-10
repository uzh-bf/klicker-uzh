import { useMutation } from '@apollo/client'
import {
  CreateKbUrlResourceDocument,
  KbResourceMaterialType,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H3,
  SelectField,
  TextField,
  toast,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { type FormEvent, useState } from 'react'
import { getGraphQLErrorCode } from '../graphqlError'
import { refreshAfterMutation } from '../refreshAfterMutation'

function isValidWebUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function KnowledgeBaseUrlForm({
  kbId,
  embedded = false,
  onResourceCreated,
}: {
  kbId: string
  embedded?: boolean
  onResourceCreated: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [urlTouched, setUrlTouched] = useState(false)
  const [materialType, setMaterialType] = useState(
    KbResourceMaterialType.CourseContent
  )
  const [createUrlResource, { loading }] = useMutation(
    CreateKbUrlResourceDocument
  )
  const urlValid = isValidWebUrl(url.trim())
  const urlInvalid = urlTouched && Boolean(url.trim()) && !urlValid
  const valid = Boolean(title.trim()) && urlValid

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid || loading) return

    try {
      await createUrlResource({
        variables: {
          kbId,
          title: title.trim(),
          url: url.trim(),
          materialType,
        },
      })
    } catch (error) {
      console.error('Failed to create KB URL resource', error)
      const code = getGraphQLErrorCode(error)
      const message =
        code === 'KB_RESOURCE_LIMIT_REACHED'
          ? t('kb.resourceLimitError')
          : code === 'KB_STORAGE_LIMIT_REACHED'
            ? t('kb.storageLimitError')
            : code === 'KB_INGESTION_DISABLED'
              ? t('kb.ingestionDisabledError')
              : t('kb.linkError')
      toast({ type: 'error', message })
      return
    }

    await refreshAfterMutation(
      onResourceCreated,
      'KB resources after link creation'
    )
    setTitle('')
    setUrl('')
    setUrlTouched(false)
    setMaterialType(KbResourceMaterialType.CourseContent)
    toast({ type: 'success', message: t('kb.linkSuccess') })
  }

  const content = (
    <>
      {!embedded ? <H3>{t('kb.linkTitle')}</H3> : null}
      <p className="mt-1 text-sm text-slate-600">{t('kb.linkDescription')}</p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <TextField
          id="kb-url-title"
          autoComplete="off"
          value={title}
          onChange={setTitle}
          label={t('kb.resourceTitleLabel')}
          required
          disabled={loading}
          data={{ cy: 'kb-url-title' }}
        />
        <TextField
          id="kb-url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={setUrl}
          label={t('kb.urlLabel')}
          placeholder="https://"
          type="url"
          required
          disabled={loading}
          onBlur={() => setUrlTouched(true)}
          aria-invalid={urlInvalid}
          aria-describedby={urlInvalid ? 'kb-url-error' : undefined}
          data={{ cy: 'kb-url' }}
        />
        <SelectField
          id="kb-url-material-type"
          label={t('kb.materialType')}
          value={materialType}
          onChange={(value) => setMaterialType(value as KbResourceMaterialType)}
          items={[
            {
              value: KbResourceMaterialType.Unclassified,
              label: t('kb.materialTypeUnclassified'),
            },
            {
              value: KbResourceMaterialType.CourseContent,
              label: t('kb.materialTypeCourseContent'),
            },
            {
              value: KbResourceMaterialType.Administrative,
              label: t('kb.materialTypeAdministrative'),
            },
          ]}
          disabled={loading}
          data={{ cy: 'kb-url-material-type' }}
        />
        {urlInvalid ? (
          <p
            id="kb-url-error"
            role="alert"
            className="text-sm text-red-700"
            data-cy="kb-url-error"
          >
            {t('kb.invalidUrl')}
          </p>
        ) : null}
        <Button
          primary
          type="submit"
          loading={loading}
          disabled={!valid || loading}
          data={{ cy: 'add-kb-url-resource' }}
        >
          <Button.Label>{t('kb.linkTitle')}</Button.Label>
        </Button>
      </form>
    </>
  )

  return embedded ? (
    <div data-cy="kb-url-form">{content}</div>
  ) : (
    <section
      id="kb-link-form"
      tabIndex={-1}
      className="scroll-mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
    >
      {content}
    </section>
  )
}

export default KnowledgeBaseUrlForm
