import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../../components/Layout'
import Chatbots from '../../components/resources/Chatbots'

function ChatbotsPage() {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.resources.chatbots')}>
      <Chatbots />
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
