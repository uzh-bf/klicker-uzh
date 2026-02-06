import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Chatbot, CreditResetPeriod } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Badge, H3, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

function ChatbotDetails({
  chatbot,
  loading,
}: {
  chatbot?: Chatbot
  loading: boolean
}) {
  const t = useTranslations()
  const { locale } = useRouter()

  if (loading) {
    return <Loader />
  }

  if (!chatbot) {
    return (
      <UserNotification className={{ root: 'mt-1.5' }}>
        {t('manage.resources.noChatbots')}
      </UserNotification>
    )
  }

  const resetPeriodLabel = (() => {
    switch (chatbot.creditResetPeriod) {
      case CreditResetPeriod.Daily:
        return t('manage.resources.creditResetPeriodDaily')
      case CreditResetPeriod.Weekly:
        return t('manage.resources.creditResetPeriodWeekly')
      case CreditResetPeriod.Biweekly:
        return t('manage.resources.creditResetPeriodBiweekly')
      case CreditResetPeriod.Monthly:
        return t('manage.resources.creditResetPeriodMonthly')
      case CreditResetPeriod.None:
        return t('manage.resources.creditResetPeriodNone')
      default:
        return chatbot.creditResetPeriod
    }
  })()

  const createdAtLabel = chatbot.createdAt
    ? dayjs(chatbot.createdAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')
  const updatedAtLabel = chatbot.updatedAt
    ? dayjs(chatbot.updatedAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')

  const usageSummary = chatbot.usageSummary
  const lastActivityLabel = usageSummary?.lastActivityAt
    ? dayjs(usageSummary.lastActivityAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')
  const lastResetLabel = usageSummary?.lastResetAt
    ? dayjs(usageSummary.lastResetAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')

  const formatNumber = (value?: number | null) =>
    value === null || value === undefined
      ? t('shared.generic.unknown')
      : value.toLocaleString()

  const pwaBaseUrl = (
    process.env.NEXT_PUBLIC_PWA_URL ?? 'https://pwa.klicker.com'
  ).replace(/\/$/, '')
  const localePrefix = locale ? `/${locale}` : ''
  const buildChatbotUrl = (courseId: string) =>
    `${pwaBaseUrl}${localePrefix}/course/${encodeURIComponent(courseId)}/chatbot/${encodeURIComponent(chatbot.id)}`

  return (
    <div data-cy="chatbot-details">
      <H3>{t('manage.resources.chatbotDetails')}</H3>
      <div className="mt-3 space-y-6">
        <div>
          <div className="flex flex-row items-start justify-between gap-4">
            <div className="text-xl font-bold">{chatbot.name}</div>
          </div>
          {chatbot.description && (
            <div className="mt-1 text-sm text-gray-600">
              {chatbot.description}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-gray-500">
            <div>
              ID: <span className="select-all">{chatbot.id}</span>
            </div>
            {chatbot.avatar && (
              <div className="flex max-w-full items-center gap-1">
                <span>Avatar:</span>
                <span className="max-w-[200px] truncate" title={chatbot.avatar}>
                  {chatbot.avatar}
                </span>
              </div>
            )}
          </div>
        </div>

        {chatbot.courses && chatbot.courses.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-medium text-gray-700">
              {t('manage.resources.linkedCourses')}
            </div>
            <ul className="list-disc pl-5 text-sm text-gray-600">
              {chatbot.courses.map((course) => (
                <li
                  key={`chatbot-course-${course.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-primary-600 hover:text-primary-800 hover:underline"
                  >
                    {course.name}
                  </Link>
                  <a
                    href={buildChatbotUrl(course.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-700 flex items-center gap-1.5 whitespace-nowrap text-xs hover:underline"
                  >
                    <span>{t('manage.resources.openChatbot')}</span>
                    <FontAwesomeIcon
                      icon={faExternalLinkAlt}
                      className="h-3 w-3"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="mb-2 text-sm font-medium text-gray-700">
            {t('manage.resources.credits')}
          </div>
          <div className="overflow-hidden rounded-lg border shadow-sm">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr className="divide-x divide-gray-200">
                  <td className="w-1/3 bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.creditInitialCredits')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {chatbot.creditInitialCredits}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.creditResetPeriod')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {resetPeriodLabel}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.creditResetAmount')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {chatbot.creditResetAmount}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.creditMaxCredits')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {chatbot.creditMaxCredits}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-gray-700">
            {t('manage.resources.usageSummary')}
          </div>
          <div className="overflow-hidden rounded-lg border shadow-sm">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr className="divide-x divide-gray-200">
                  <td className="w-1/3 bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.usageThreads')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {usageSummary?.threadCount ?? 0}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.usageMessages')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {usageSummary?.messageCount ?? 0}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.usageParticipants')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {usageSummary?.participantCount ?? 0}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.usageLastActivity')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {lastActivityLabel}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.usageTotalCredits')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {formatNumber(usageSummary?.totalCredits)}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.usageCurrentCredits')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {formatNumber(usageSummary?.currentCredits)}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.usageTotalResets')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {usageSummary?.totalResets ?? 0}
                  </td>
                </tr>
                <tr className="divide-x divide-gray-200">
                  <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                    {t('manage.resources.usageLastReset')}
                  </td>
                  <td className="px-4 py-2 text-gray-900">{lastResetLabel}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {chatbot.disclaimerSummary && (
          <div>
            <div className="mb-2 text-sm font-medium text-gray-700">
              {t('manage.resources.disclaimer')}
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="mb-1 font-semibold text-gray-900">
                {chatbot.disclaimerSummary.title}
              </div>
              <div className="mb-3 text-gray-600">
                {chatbot.disclaimerSummary.name}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                  {t('manage.resources.disclaimerAccepted')}:{' '}
                  {chatbot.disclaimerSummary.acceptedCount}
                </Badge>
                <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
                  {t('manage.resources.disclaimerDeclined')}:{' '}
                  {chatbot.disclaimerSummary.declinedCount}
                </Badge>
                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                  {t('manage.resources.disclaimerPending')}:{' '}
                  {chatbot.disclaimerSummary.pendingCount}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {chatbot.mcpConfigurations && chatbot.mcpConfigurations.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-gray-700">
              {t('manage.resources.mcpConfigurations')}
            </div>
            <div className="overflow-hidden rounded-lg border shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2">{t('shared.generic.server')}</th>
                    <th className="px-4 py-2">
                      {t('manage.resources.mcpChatMode')}
                    </th>
                    <th className="px-4 py-2">
                      {t('manage.resources.mcpStatus')}
                    </th>
                    <th className="px-4 py-2">
                      {t('manage.resources.mcpPriority')}
                    </th>
                    <th className="px-4 py-2">
                      {t('manage.resources.mcpAllowedTools')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {chatbot.mcpConfigurations.map((config) => (
                    <tr
                      key={`${chatbot.id}-${config.serverId}-${config.chatMode}`}
                    >
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">
                          {config.serverName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {config.serverIsActive
                            ? t('manage.resources.mcpServerActive')
                            : t('manage.resources.mcpServerInactive')}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {config.chatMode}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={twMerge(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            config.isEnabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          )}
                        >
                          {config.isEnabled
                            ? t('manage.resources.mcpStatusEnabled')
                            : t('manage.resources.mcpStatusDisabled')}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {config.priority}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {config.allowedToolsCount ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-4 border-t pt-4 text-xs text-gray-500">
          <div>
            {t('manage.resources.modelSelection')}:{' '}
            {chatbot.modelSelection
              ? t('manage.resources.modelSelectionEnabled')
              : t('manage.resources.modelSelectionDisabled')}
          </div>
          <div>•</div>
          <div>
            {t('manage.resources.allowedModels')}:{' '}
            {chatbot.allowedModelIds && chatbot.allowedModelIds.length > 0
              ? chatbot.allowedModelIds.join(', ')
              : t('manage.resources.allowedModelsAll')}
          </div>
          <div>•</div>
          <div>
            {t('shared.generic.createdAt', {
              date: createdAtLabel,
            })}
          </div>
          <div>•</div>
          <div>
            {t('shared.generic.updatedAt', {
              date: updatedAtLabel,
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatbotDetails
