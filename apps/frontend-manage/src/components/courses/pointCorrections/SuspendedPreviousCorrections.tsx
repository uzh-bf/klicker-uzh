import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  ShadcnCollapsible,
  ShadcnCollapsibleContent,
  ShadcnCollapsibleTrigger,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { trpc } from '../../../lib/trpc'
import PreviousPointCorrectionList from './PreviousPointCorrectionList'

function SuspendedPreviousCorrections({
  instanceScope,
  liveQuizId,
  instanceId,
}: {
  instanceScope: boolean
  liveQuizId: string
  instanceId: string
}) {
  const t = useTranslations()

  // fetch the previous corrections for the given live quiz / instance
  const parsedInstanceId =
    instanceScope && instanceId && instanceId !== ''
      ? parseInt(instanceId, 10)
      : undefined
  const validInstanceId =
    typeof parsedInstanceId === 'number' && !Number.isNaN(parsedInstanceId)
  const hasLiveQuizId = Boolean(liveQuizId)
  const { data, error, isLoading } =
    trpc.activity.previousPointCorrections.useQuery(
      {
        liveQuizId,
        instanceId: validInstanceId ? parsedInstanceId : undefined,
      },
      { enabled: hasLiveQuizId }
    )
  const corrections = data?.previousPointCorrections ?? []
  const correctionsUnavailable = Boolean(error && !data)
  const [collapsibleOpen, setCollapsibleOpen] = useState(false)

  if (!hasLiveQuizId) {
    return (
      <div className="text-sm text-gray-600">
        {instanceScope
          ? t('manage.pointCorrections.historyPlaceholderInstance')
          : t('manage.pointCorrections.historyPlaceholder')}
      </div>
    )
  }

  if (isLoading) {
    return <Loader />
  }

  if (correctionsUnavailable) {
    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
      />
    )
  }

  if (corrections.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        {instanceScope
          ? t('manage.pointCorrections.historyPlaceholderInstance')
          : t('manage.pointCorrections.historyPlaceholder')}
      </div>
    )
  }

  return (
    <ShadcnCollapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
      <ShadcnCollapsibleTrigger className="text-primary-100 flex w-fit items-center gap-2 text-sm font-medium transition-colors hover:underline focus:outline-none focus-visible:underline">
        <span>
          {collapsibleOpen
            ? t('manage.pointCorrections.historyToggleHide')
            : t('manage.pointCorrections.historyToggleShow')}
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsibleOpen ? 'rotate-180' : ''}`}
        />
      </ShadcnCollapsibleTrigger>
      <ShadcnCollapsibleContent className="mt-3">
        <PreviousPointCorrectionList corrections={corrections} />
      </ShadcnCollapsibleContent>
    </ShadcnCollapsible>
  )
}

export default SuspendedPreviousCorrections
