import { getVideoEmbedSrc, parseVideoEmbedUrl } from '@klicker-uzh/markdown'
import { Button, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface VideoEmbedInputProps {
  onInsert: (url: string) => void
}

function VideoEmbedInput({ onInsert }: VideoEmbedInputProps) {
  const t = useTranslations()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string>()

  const insertVideo = () => {
    const video = parseVideoEmbedUrl(url.trim())
    if (!video) {
      setError(t('shared.contentInput.videoUrlInvalid'))
      return
    }

    onInsert(getVideoEmbedSrc(video))
  }

  return (
    <div className="flex w-full flex-col gap-2 p-3 md:flex-row md:items-end">
      <TextField
        id="video-embed-url"
        autoFocus
        label={t('shared.contentInput.videoUrl')}
        value={url}
        onChange={(newValue) => {
          setUrl(newValue)
          setError(undefined)
        }}
        onEnter={insertVideo}
        placeholder={t('shared.contentInput.videoUrlPlaceholder')}
        error={error}
        isTouched={typeof error !== 'undefined'}
        aria-invalid={typeof error !== 'undefined'}
        className={{ field: 'min-w-0 flex-1', input: 'w-full' }}
        data={{ cy: 'video-embed-url' }}
      />
      <Button
        primary
        onClick={insertVideo}
        data={{ cy: 'insert-video-embed' }}
        className={{ root: 'shrink-0' }}
      >
        {t('shared.contentInput.insertVideo')}
      </Button>
    </div>
  )
}

export default VideoEmbedInput
