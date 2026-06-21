import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ChatbotItem from './ChatbotItem'
import type { Chatbot } from './types'

function ChatbotList({
  chatbots,
  error,
  loading,
  selectedId,
  onSelect,
}: {
  chatbots?: Chatbot[]
  error: boolean
  loading: boolean
  selectedId?: string
  onSelect: (chatbot: Chatbot) => void
}) {
  const t = useTranslations()

  if (loading) {
    return <Loader />
  }

  if (error) {
    return (
      <UserNotification className={{ root: 'mt-1.5' }} type="error">
        {t('shared.generic.systemError')}
      </UserNotification>
    )
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
              selected={chatbot.id === selectedId}
              onSelect={() => onSelect(chatbot)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ChatbotList
