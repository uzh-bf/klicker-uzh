import {
  EnsureParticipationDocument,
  GetCourseChatbotsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Layout from '../../../../components/Layout'
import { initializeApollo } from '../../../../lib/apollo'
import getParticipantToken from '../../../../lib/getParticipantToken'

type CourseChatbotEntryPageProps = {
  noChatbot?: boolean
  courseLink?: string
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    if (typeof ctx.params?.courseId !== 'string') {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          permanent: false,
        },
      }
    }

    const apolloClient = initializeApollo(undefined, ctx)
    const courseId = ctx.params.courseId
    const embedded = parseEmbedParam(ctx.query.embed)
    const localePrefix = ctx.locale ? `/${ctx.locale}` : ''
    const coursePath = `${localePrefix}/course/${courseId}`

    const { participantToken } = await getParticipantToken({
      apolloClient,
      courseId,
      ctx,
    })

    if (!participantToken) {
      const currentPath = `${coursePath}/chatbot${embedded ? '?embed=true' : ''}`
      return {
        redirect: {
          destination: `${localePrefix}/login?redirect_to=${encodeURIComponent(
            currentPath
          )}`,
          permanent: false,
        },
      }
    }

    const headers = { authorization: `Bearer ${participantToken}` }
    const ensureResult = await apolloClient.mutate({
      mutation: EnsureParticipationDocument,
      variables: { courseId },
      context: { headers },
    })

    if (!ensureResult.data?.ensureParticipation) {
      return {
        props: {
          noChatbot: false,
          courseLink: coursePath,
          messages: (
            await import(`@klicker-uzh/i18n/messages/${ctx.locale ?? 'en'}`)
          ).default,
        },
      }
    }

    const chatbotResult = await apolloClient.query({
      query: GetCourseChatbotsDocument,
      variables: { courseId },
      context: { headers },
      fetchPolicy: 'no-cache',
    })
    const chatbot = chatbotResult.data.courseChatbots[0]

    if (!chatbot) {
      return {
        props: {
          noChatbot: true,
          courseLink: coursePath,
          messages: (
            await import(`@klicker-uzh/i18n/messages/${ctx.locale ?? 'en'}`)
          ).default,
        },
      }
    }

    return {
      redirect: {
        destination: `${coursePath}/chatbot/${chatbot.id}${
          embedded ? '?embed=true' : ''
        }`,
        permanent: false,
      },
    }
  } catch (error) {
    console.error('Error in getServerSideProps on course chatbot entry:', error)
    return {
      redirect: {
        destination: '/error',
        permanent: false,
      },
    }
  }
}

function CourseChatbotEntryPage({
  noChatbot,
  courseLink,
}: CourseChatbotEntryPageProps) {
  const t = useTranslations()

  return (
    <Layout>
      <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-xl md:py-10">
        <UserNotification
          type={noChatbot ? 'info' : 'warning'}
          message={
            noChatbot
              ? t('pwa.chatbot.noCourseChatbot')
              : t('pwa.chatbot.participationRequiredMessage')
          }
        />
        {courseLink && (
          <Link
            href={courseLink}
            className="bg-uzh-blue hover:bg-uzh-blue-80 rounded px-4 py-2 text-center text-white"
            data-cy="course-chatbot-course-link"
          >
            {t('pwa.chatbot.goToCourse')}
          </Link>
        )}
      </div>
    </Layout>
  )
}

export default CourseChatbotEntryPage
