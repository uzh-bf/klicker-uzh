import { EnsureParticipationDocument } from '@klicker-uzh/graphql/dist/ops'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Layout from '../../../../components/Layout'
import { initializeApollo } from '../../../../lib/apollo'
import { mintPwaChatEmbedExchangeToken } from '../../../../lib/chatbot/embedAuth'
import getParticipantToken from '../../../../lib/getParticipantToken'

type ChatbotPageProps = {
  participationError?: boolean
  courseLink?: string
}

function getChatBaseUrl() {
  const chatUrl =
    process.env.NEXT_PUBLIC_CHAT_URL ?? process.env.APP_ORIGIN_CHAT

  if (!chatUrl) return null

  try {
    return new URL(chatUrl)
  } catch {
    return null
  }
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    if (
      typeof ctx.params?.courseId !== 'string' ||
      typeof ctx.params?.chatbotId !== 'string'
    ) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          permanent: false,
        },
      }
    }

    const apolloClient = initializeApollo(undefined, ctx)
    const courseId = ctx.params.courseId as string
    const chatbotId = ctx.params.chatbotId as string
    const embedded = parseEmbedParam(ctx.query.embed)

    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
      courseId,
      ctx,
    })

    const localePrefix = ctx.locale ? `/${ctx.locale}` : ''
    const coursePath = `${localePrefix}/course/${courseId}`
    const currentPath = `${coursePath}/chatbot/${chatbotId}${embedded ? '?embed=true' : ''}`
    const loginUrl = `${localePrefix}/login?redirect_to=${encodeURIComponent(currentPath)}`

    if (!participantToken || typeof participantToken !== 'string') {
      return {
        redirect: {
          destination: loginUrl,
          permanent: false,
        },
      }
    }

    let ensureSuccess = true

    try {
      const result = await apolloClient.mutate({
        mutation: EnsureParticipationDocument,
        variables: { courseId },
        context: {
          headers: { authorization: `Bearer ${participantToken}` },
        },
      })

      ensureSuccess = Boolean(result.data?.ensureParticipation)
    } catch (err) {
      ensureSuccess = false
      console.error('Failed to ensure participation before chatbot redirect', {
        courseId,
        err,
      })
    }

    if (!ensureSuccess) {
      return {
        props: {
          participationError: true,
          courseLink: coursePath,
          messages: (
            await import(`@klicker-uzh/i18n/messages/${ctx.locale ?? 'en'}`)
          ).default,
        },
      }
    }

    const chatBaseUrl = getChatBaseUrl()
    if (!chatBaseUrl) {
      console.error('Missing or invalid chat URL for chatbot redirect')

      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/error`,
          permanent: false,
        },
      }
    }

    const chatDestination = new URL(
      embedded ? '/auth/pwa-embed' : `/${encodeURIComponent(chatbotId)}`,
      chatBaseUrl
    )
    if (embedded) {
      let exchangeToken
      try {
        exchangeToken = await mintPwaChatEmbedExchangeToken({
          chatbotId,
          cookiesAvailable: cookiesAvailable !== false,
          courseId,
          participantToken,
        })
      } catch (err) {
        console.error('Failed to mint PWA chat embed exchange token', {
          chatbotId,
          courseId,
          err,
        })
        return {
          redirect: {
            destination: loginUrl,
            permanent: false,
          },
        }
      }

      chatDestination.searchParams.set('embed', 'true')
      chatDestination.searchParams.set('token', exchangeToken)
    }

    return {
      redirect: {
        destination: chatDestination.toString(),
        permanent: false,
      },
    }
  } catch (error) {
    console.error('Error in getServerSideProps on chatbot:', error)

    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/error`,
        permanent: false,
      },
    }
  }
}

const ChatbotPage = ({ participationError, courseLink }: ChatbotPageProps) => {
  const t = useTranslations()

  if (participationError) {
    return (
      <Layout>
        <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-xl md:py-10">
          <UserNotification type="warning">
            {t('pwa.chatbot.participationRequiredMessage')}
          </UserNotification>
          {courseLink && (
            <Link
              href={courseLink}
              className="bg-uzh-blue hover:bg-uzh-blue-80 rounded px-4 py-2 text-center text-white"
            >
              {t('pwa.chatbot.goToCourse')}
            </Link>
          )}
        </div>
      </Layout>
    )
  }

  return null
}

export default ChatbotPage
