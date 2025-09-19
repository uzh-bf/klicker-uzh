import { GetServerSidePropsContext } from 'next'
import { initializeApollo } from '~/lib/apollo'
import getParticipantToken from '~/lib/getParticipantToken'

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    const apolloClient = initializeApollo()

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

    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
      courseId: ctx.params.courseId,
      ctx,
    })

    return {
      redirect: {
        destination: new URL(
          encodeURIComponent(ctx.params.chatbotId),
          process.env.NEXT_PUBLIC_CHAT_URL
        ).toString(),
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

const ChatbotPage = () => null

export default ChatbotPage
