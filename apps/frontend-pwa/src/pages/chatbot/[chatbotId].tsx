import { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const { chatbotId } = query

  if (typeof chatbotId === 'string') {
    return {
      redirect: {
        destination: `${process.env.NEXT_PUBLIC_CHAT_URL}/${chatbotId}`,
        permanent: true,
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
