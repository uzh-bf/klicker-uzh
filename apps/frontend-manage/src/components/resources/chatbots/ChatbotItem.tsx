import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import type { Chatbot } from './types'

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
        <span className="font-medium">{chatbot.name}</span>
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
