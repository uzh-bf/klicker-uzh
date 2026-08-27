import { Chatbot } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ChatbotItem from './ChatbotItem'

function ChatbotList({
  chatbots,
  loading,
  selectedId,
  onSelect,
  onCreate,
}: {
  chatbots?: Chatbot[]
  loading: boolean
  selectedId?: string
  onSelect: (chatbot: Chatbot) => void
  onCreate: () => void
}) {
  const t = useTranslations()

  if (loading) {
    return <Loader />
  }

  return (
    <div data-cy="chatbot-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <H3>{t('manage.resources.availableChatbots')}</H3>
        <Button primary onClick={onCreate} data={{ cy: 'create-chatbot' }}>
          <Button.Label>{t('manage.resources.createChatbot')}</Button.Label>
        </Button>
      </div>
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
