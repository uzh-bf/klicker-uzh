import { useQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  ManageUserProfileDocument,
  UserLoginScope,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Layout from '../../components/Layout'
import Chatbots from '../../components/resources/Chatbots'

function ChatbotsPage() {
  const t = useTranslations()
  const aiBetaEnabled = useFeatureFlag('ai-beta')
  const { data } = useQuery(ManageUserProfileDocument, {
    fetchPolicy: 'cache-first',
    ssr: false,
  })
  const canAuthor =
    aiBetaEnabled &&
    data?.userProfile?.catalyst === true &&
    (data.userScope === UserLoginScope.FullAccess ||
      data.userScope === UserLoginScope.AccountOwner)

  return (
    <Layout displayName={t('manage.resources.chatbots')}>
      {canAuthor ? (
        <Chatbots />
      ) : (
        <div data-cy="chatbot-authoring-unavailable">
          <UserNotification type="info">
            <p>{t('manage.settings.chatbotBetaAccessRequired')}</p>
            <Link
              href="/user/settings#beta-features"
              className="underline"
              data-cy="chatbot-beta-settings"
            >
              {t('manage.settings.betaFeaturesTitle')}
            </Link>
          </UserNotification>
        </div>
      )}
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
