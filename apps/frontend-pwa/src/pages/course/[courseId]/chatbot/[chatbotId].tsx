import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { createTRPCSSRClient } from '@lib/trpc'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Layout from '../../../../components/Layout'
import getParticipantToken from '../../../../lib/getParticipantToken'

type ChatbotPageProps = {
  participationError?: boolean
  courseLink?: string
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

    const courseId = ctx.params.courseId as string
    const chatbotId = ctx.params.chatbotId as string
    const embedded = parseEmbedParam(ctx.query.embed)

    const { participantToken } = await getParticipantToken({
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
      const trpcClient = createTRPCSSRClient(ctx, {
        authorization: `Bearer ${participantToken}`,
      })

      ensureSuccess = await trpcClient.participant.ensureParticipation.mutate({
        courseId,
      })
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
  } catch (error) {
    console.error('Error in getServerSideProps on chatbot:', error)

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
