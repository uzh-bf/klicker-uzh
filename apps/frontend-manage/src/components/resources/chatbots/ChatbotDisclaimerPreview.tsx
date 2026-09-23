import { Markdown } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'

interface ChatbotDisclaimerPreviewProps {
  title: string
  introText: string
}

function ChatbotDisclaimerPreview({
  title,
  introText,
}: ChatbotDisclaimerPreviewProps) {
  const t = useTranslations()

  return (
    <section
      aria-label={t('manage.resources.chatbotDisclaimerPreview')}
      data-cy="chatbot-disclaimer-preview"
      className="space-y-6 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h5 className="text-lg font-semibold text-gray-900">
        {title || t('manage.resources.chatbotDisclaimerTitlePlaceholder')}
      </h5>
      <div className="flex flex-col gap-6 md:flex-row md:gap-12">
        {introText ? (
          <Markdown
            content={introText}
            withProse
            className={{ root: 'prose prose-sm max-w-none' }}
          />
        ) : (
          <p className="text-sm text-gray-500">
            {t('manage.resources.chatbotDisclaimerIntroPlaceholder')}
          </p>
        )}
      </div>
      <div className="max-w-none space-y-6">
        <div className="prose prose-sm bg-muted max-w-none rounded-lg p-4">
          <h5 className="text-lg font-semibold">
            {t('chat.disclaimer.studentResponsibilityTitle')}
          </h5>
          <p className="text-sm">
            {t('chat.disclaimer.studentResponsibilityText')}
          </p>
        </div>
        <div className="prose prose-sm bg-muted max-w-none rounded-lg p-4">
          <h5 className="text-lg font-semibold">
            {t('chat.disclaimer.dataProtectionTitle')}
          </h5>
          <p className="mb-4 text-sm">
            {t('chat.disclaimer.dataProtectionText')}
          </p>
          <p className="text-sm">{t('chat.disclaimer.consentText')}</p>
        </div>
      </div>
      <div
        className="prose prose-sm max-w-none rounded-lg bg-yellow-50 p-4"
        data-cy="chatbot-disclaimer-consequences"
      >
        <p className="font-medium text-yellow-800">
          {t('chat.disclaimer.consequenceTitle')}
        </p>
        <ul className="mt-2 list-disc space-y-1 text-yellow-700">
          <li>{t('chat.disclaimer.consequenceAccept')}</li>
          <li>{t('chat.disclaimer.consequenceDecline')}</li>
        </ul>
      </div>
    </section>
  )
}

export default ChatbotDisclaimerPreview
