import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import AiBetaUnavailable from '../../components/AiBetaUnavailable'
import Layout from '../../components/Layout'
import Chatbots from '../../components/resources/Chatbots'
import { useAiFeaturesEnabled } from '../../lib/hooks/useAiFeaturesEnabled'

function ChatbotsPage() {
  const t = useTranslations()
  const aiFeaturesEnabled = useAiFeaturesEnabled()

  return (
    <Layout displayName={t('manage.resources.chatbots')}>
      {aiFeaturesEnabled ? <Chatbots /> : <AiBetaUnavailable />}
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default ChatbotsPage
