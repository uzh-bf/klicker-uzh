'use client'

import { useTranslations } from 'next-intl'

export interface ByokQuotaStatusProps {
  remainingByokQuota: string
  currency: string
  usedAmount: string
  error?: string | null
}

/**
 * Displays remaining BYOK quota separately from UZH credits. Rendered in the
 * chat footer when a BYOK binding is active for the current chatbot.
 */
export function ByokQuotaStatus({
  remainingByokQuota,
  currency,
  usedAmount,
  error,
}: ByokQuotaStatusProps) {
  const t = useTranslations()

  if (error) {
    return (
      <div
        className="text-sm text-red-600 dark:text-red-400"
        data-testid="byok-error"
        role="alert"
      >
        {t('byok.quota.error')}
      </div>
    )
  }

  return (
    <div className="text-sm" data-testid="byok-quota">
      <span className="font-medium">{t('byok.quota.remaining')}:</span>{' '}
      {currency} {remainingByokQuota}
      <span className="mx-2 text-slate-400">·</span>
      <span className="font-medium">{t('byok.quota.used')}:</span> {currency}{' '}
      {usedAmount}
    </div>
  )
}
