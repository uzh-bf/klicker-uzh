import { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const { chatbotId } = query

  if (typeof chatbotId === 'string') {
    return {
      redirect: {
        destination: new URL(
          encodeURIComponent(chatbotId),
          process.env.NEXT_PUBLIC_CHAT_URL
        ).toString(),
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: '/error',
      permanent: false,
    },
  }
}

const ChatbotPage = () => null

export default ChatbotPage
