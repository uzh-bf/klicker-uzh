import { Chatbot } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ChatbotItem from './ChatbotItem'

function ChatbotList({
  chatbots,
  loading,
  onOpen,
}: Readonly<{
  chatbots?: Chatbot[]
  loading: boolean
  onOpen: (chatbot: Chatbot) => void
}>) {
  const t = useTranslations()

  if (loading) {
    return <Loader />
  }

  return (
    <div data-cy="chatbot-list">
      <H3>{t('manage.resources.availableChatbots')}</H3>
      {chatbots && chatbots.length === 0 ? (
        <UserNotification className={{ root: 'mt-1.5' }}>
          {t('manage.resources.noChatbots')}
        </UserNotification>
      ) : (
        <div className="mt-1 flex flex-col">
          {chatbots?.map((chatbot) => (
            <ChatbotItem
              key={`chatbot-${chatbot.id}`}
              chatbot={chatbot}
              onOpen={() => onOpen(chatbot)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ChatbotList
