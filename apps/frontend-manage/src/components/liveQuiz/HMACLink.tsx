import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

function HMACLink({
  quizId,
  hmac,
  params,
  identifier,
  language,
}: {
  quizId: string
  hmac: string
  params: string
  identifier: string
  language: string
}) {
  const t = useTranslations()
  const link = `${
    process.env.NEXT_PUBLIC_MANAGE_URL
  }${language === 'en' ? '' : `/${language}`}/quizzes/${quizId}/evaluation?hmac=${hmac}${params ? `&${params}` : ''}`

  return (
    <div className="bg-accent flex max-w-full flex-row items-center justify-between gap-3 rounded px-2 py-1">
      <Link
        href={link}
        data-cy={`open-embedding-link-${identifier}`}
        className="max-w-[calc(100%-3.5rem)] break-words text-sm"
        target="_blank"
        rel="noopener noreferrer"
      >
        {link}
      </Link>
      <Button
        onClick={() => {
          navigator?.clipboard?.writeText(link)
          toast({
            type: 'success',
            message: t('manage.liveQuizzes.embeddingLinkCopied'),
          })
        }}
        data={{ cy: `copy-embed-link-live-quiz-${quizId}` }}
      >
        <Button.Icon withoutLabel icon={faClipboard} />
      </Button>
    </div>
  )
}

export default HMACLink
