'use client'

import {
  type ElementSourceReference,
  getElementSourceLocatorTarget,
} from '@klicker-uzh/types'
import { ExternalLinkIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { getElementSourceLocatorLabel } from '@/src/lib/sources/sourceDisplay'

export function SourceActionLinks({
  source,
}: {
  source: ElementSourceReference
}) {
  const t = useTranslations()
  const actions = source.locators.flatMap((locator) => {
    const url = getElementSourceLocatorTarget(source, locator)
    return url ? [{ locator, url }] : []
  })

  if (actions.length === 0) {
    return (
      <span
        className="text-muted-foreground mt-1 block text-[11px]"
        data-cy="element-source-unavailable"
      >
        {t('chat.sources.unavailable')}
      </span>
    )
  }

  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {actions.map(({ locator, url }) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border text-primary inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:underline"
          data-cy="element-source-action"
        >
          {getElementSourceLocatorLabel(locator, t)}
          <ExternalLinkIcon aria-hidden="true" className="size-3" />
          <span className="sr-only">{t('chat.common.opensInNewTab')}</span>
        </a>
      ))}
    </span>
  )
}
