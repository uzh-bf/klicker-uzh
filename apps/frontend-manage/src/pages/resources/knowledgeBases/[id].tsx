import { useQuery } from '@apollo/client'
import { QGetChatbotsInfoWithKnowledgeBasesDocument } from '@klicker-uzh/graphql/dist/ops'
import { KnowledgeBaseDetail } from '@klicker-uzh/kb-management'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import AiBetaUnavailable from '../../../components/AiBetaUnavailable'
import Layout from '../../../components/Layout'
import { useAiFeaturesEnabled } from '../../../lib/hooks/useAiFeaturesEnabled'

function KnowledgeBasePage({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const aiFeaturesEnabled = useAiFeaturesEnabled()
  const router = useRouter()
  const requestedChatbotId =
    typeof router.query.chatbotId === 'string'
      ? router.query.chatbotId
      : undefined
  const { data: chatbotData } = useQuery(
    QGetChatbotsInfoWithKnowledgeBasesDocument,
    { skip: !requestedChatbotId || !aiFeaturesEnabled }
  )
  // The way back is offered only for one of the lecturer's own chatbots and is
  // built from that chatbot, never from the raw query parameter.
  const chatbot = chatbotData?.getChatbotsInfo?.find(
    ({ id }) => id === requestedChatbotId
  )
  const backLink = chatbot
    ? {
        href: `/resources/chatbots?chatbotId=${encodeURIComponent(chatbot.id)}&view=knowledge`,
        label: t('manage.resources.backToChatbot', { name: chatbot.name }),
      }
    : undefined

  return (
    <Layout displayName={t('kb.title')}>
      {aiFeaturesEnabled ? (
        <KnowledgeBaseDetail kbId={kbId} backLink={backLink} />
      ) : (
        <AiBetaUnavailable />
      )}
    </Layout>
  )
}

export async function getStaticProps({
  locale,
  params,
}: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
      kbId: params?.id,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default KnowledgeBasePage
