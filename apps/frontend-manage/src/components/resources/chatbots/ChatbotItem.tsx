import type { Chatbot } from '@klicker-uzh/graphql/dist/ops'
import { Badge } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { getChatbotStatusTranslationKey } from './chatbotStatus'

function ChatbotItem({
  chatbot,
  selected,
  onSelect,
}: {
  chatbot: Chatbot
  selected?: boolean
  onSelect: () => void
}) {
  const t = useTranslations()
  const courseNames = chatbot.courses?.map((course) => course.name) ?? []

  return (
    <button
      type="button"
      onClick={onSelect}
      className={twMerge(
        'my-[0.2rem] flex w-full items-center justify-between rounded-md border border-solid px-4 py-3 text-left shadow-sm transition-all hover:shadow-md',
        selected && 'border-primary-100 bg-orange-50'
      )}
      data-cy={`chatbot-${chatbot.name}`}
    >
      <div className="flex flex-col items-start">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{chatbot.name}</span>
          <Badge
            className="bg-gray-100 text-gray-800 hover:bg-gray-200"
            data-cy="chatbot-status"
          >
            {t(getChatbotStatusTranslationKey(chatbot.status))}
          </Badge>
        </div>
        <div className="text-sm text-gray-500">
          {courseNames.length > 0
            ? t('manage.resources.linkedCoursesList', {
                courses: courseNames.join(', '),
              })
            : t('manage.resources.noLinkedCourses')}
        </div>
      </div>
    </button>
  )
}

export default ChatbotItem
