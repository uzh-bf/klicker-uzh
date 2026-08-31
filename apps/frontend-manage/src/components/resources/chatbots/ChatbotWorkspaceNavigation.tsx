import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import type { ChatbotSetupStep, ChatbotWorkspaceView } from './chatbotWorkspace'

const viewItems = [
  {
    view: 'overview',
    label: 'manage.resources.chatbotWorkspaceOverview',
  },
  { view: 'setup', label: 'manage.resources.chatbotWorkspaceSetup' },
  { view: 'advanced', label: 'manage.resources.chatbotWorkspaceAdvanced' },
  { view: 'usage', label: 'manage.resources.chatbotWorkspaceUsage' },
] as const satisfies ReadonlyArray<{
  view: ChatbotWorkspaceView
  label: string
}>

function ChatbotWorkspaceNavigation({
  view,
  step,
  onNavigate,
}: {
  view: ChatbotWorkspaceView
  step?: ChatbotSetupStep
  onNavigate: (view: ChatbotWorkspaceView, step?: ChatbotSetupStep) => void
}) {
  const t = useTranslations()

  return (
    <nav
      aria-label={t('manage.resources.chatbotWorkspaceNavigation')}
      className="border-b border-gray-200"
      data-cy="chatbot-workspace-navigation"
    >
      <div className="flex gap-1 overflow-x-auto">
        {viewItems.map((item) => {
          const active = item.view === view
          const requestedStep = item.view === 'setup' ? step : undefined

          return (
            <button
              key={item.view}
              type="button"
              aria-current={active ? 'page' : undefined}
              className={twMerge(
                'min-h-11 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
              )}
              data-cy={`chatbot-view-${item.view}`}
              onClick={() => onNavigate(item.view, requestedStep)}
            >
              {t(item.label)}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default ChatbotWorkspaceNavigation
