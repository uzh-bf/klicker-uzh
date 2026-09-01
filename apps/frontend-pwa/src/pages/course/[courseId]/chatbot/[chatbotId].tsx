import { EnsureParticipationDocument } from '@klicker-uzh/graphql/dist/ops'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { UserNotification } from '@uzh-bf/design-system'
import type { GetServerSidePropsContext } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Layout from '../../../../components/Layout'
import { initializeApollo } from '../../../../lib/apollo'
import getParticipantToken from '../../../../lib/getParticipantToken'

type ChatbotPageProps = {
  participationError?: boolean
  courseLink?: string
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { createSsrRequestLogging } = await import('@lib/server/logger')
  const { logFailure, requestContext } = createSsrRequestLogging(
    ctx.req.headers,
    '/course/:courseId/chatbot/:chatbotId'
  )

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

    const apolloClient = initializeApollo(undefined, ctx, requestContext)
    const courseId = ctx.params.courseId as string
    const chatbotId = ctx.params.chatbotId as string
    const embedded = parseEmbedParam(ctx.query.embed)

    const { participantToken } = await getParticipantToken({
      apolloClient,
      courseId,
      ctx,
    })

    const localePrefix = ctx.locale ? `/${ctx.locale}` : ''
    const coursePath = `${localePrefix}/course/${courseId}`

    if (!participantToken) {
      const currentPath = `${coursePath}/chatbot/${chatbotId}${embedded ? '?embed=true' : ''}`
      const loginUrl = `${localePrefix}/login?redirect_to=${encodeURIComponent(currentPath)}`

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
    } catch {
      ensureSuccess = false
      logFailure('participation_setup_failed')
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

    const chatDestination = new URL(
      encodeURIComponent(chatbotId),
      process.env.NEXT_PUBLIC_CHAT_URL
    )
    if (embedded) {
      chatDestination.searchParams.set('embed', 'true')
    }

    return {
      redirect: {
        destination: chatDestination.toString(),
        permanent: false,
      },
    }
  } catch {
    logFailure('data_load_failed')

    return {
      redirect: {
        destination: '/error',
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
