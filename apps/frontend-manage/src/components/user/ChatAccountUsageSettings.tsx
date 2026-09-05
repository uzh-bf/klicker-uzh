import { useSuspenseQuery } from '@apollo/client'
import {
  type ChatAccountUsageLane,
  GetChatAccountUsageDocument,
  GetUserLoginsDocument,
  UserLoginScope,
} from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import Setting from './Setting'

function ChatAccountUsageSettings() {
  const { data } = useSuspenseQuery(GetUserLoginsDocument)

  if (data.userScope !== UserLoginScope.AccountOwner) return null

  return <ChatAccountUsageSettingsContent />
}

function ChatAccountUsageSettingsContent() {
  const t = useTranslations()
  const { data } = useSuspenseQuery(GetChatAccountUsageDocument)
  const overview = data.getChatAccountUsage

  if (!overview) return null

  return (
    <Setting title={t('manage.settings.chatAccountUsageTitle')}>
      <div className="mb-5 flex flex-col gap-3">
        <p>{t('manage.settings.chatAccountUsageDescription')}</p>
        <p
          className="text-sm text-gray-600"
          data-cy="chat-account-usage-boundary"
        >
          {t('manage.settings.chatAccountUsageBoundaryDescription')}
        </p>

        {!overview.authorized && (
          <div
            role="status"
            className="rounded-md border border-solid border-amber-300 bg-amber-50 px-3 py-2 text-amber-900"
            data-cy="chat-account-usage-unauthorized"
          >
            {t('manage.settings.chatAccountUsageUnauthorized')}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <UsageLaneCard
            label={t('manage.settings.baseModelUsage')}
            lane={overview.baseModelUsage}
            testId="chat-account-usage-base"
          />
          <UsageLaneCard
            label={t('manage.settings.advancedModelUsage')}
            lane={overview.advancedModelUsage}
            testId="chat-account-usage-advanced"
          />
        </div>
      </div>
    </Setting>
  )
}

function UsageLaneCard({
  label,
  lane,
  testId,
}: {
  label: string
  lane: ChatAccountUsageLane
  testId: string
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const exhausted = lane.usedCredits > 0 && lane.remainingCredits === 0
  const empty = lane.budgetCredits === 0 && lane.usedCredits === 0
  const formatCredits = (value: number) =>
    formatter.number(value, { maximumFractionDigits: 6 })
  const formatResetDate = (value: unknown) =>
    formatter.dateTime(new Date(String(value)), { dateStyle: 'medium' })

  return (
    <section
      aria-label={label}
      className="rounded-md border border-solid border-gray-200 bg-gray-50 p-3"
      data-cy={testId}
    >
      <H3 className={{ root: 'mb-2' }}>{label}</H3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Metric
          label={t('manage.settings.usageBudget')}
          value={formatCredits(lane.budgetCredits)}
        />
        <Metric
          label={t('manage.settings.usageUsed')}
          value={formatCredits(lane.usedCredits)}
        />
        <Metric
          label={t('manage.settings.usageRemaining')}
          value={formatCredits(lane.remainingCredits)}
        />
        <Metric
          label={t('manage.settings.usageResetDate')}
          value={formatResetDate(lane.resetAt)}
        />
      </dl>
      {(exhausted || empty) && (
        <p className="mt-3 font-medium text-amber-800">
          {t(
            exhausted
              ? 'manage.settings.usageBudgetExhausted'
              : 'manage.settings.usageBudgetEmpty'
          )}
        </p>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-neutral-600">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}

export default ChatAccountUsageSettings
