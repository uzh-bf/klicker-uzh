import { useSuspenseQuery } from '@apollo/client'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetPreviousPointCorrectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  ShadcnCollapsible,
  ShadcnCollapsibleContent,
  ShadcnCollapsibleTrigger,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
  const { data } = useSuspenseQuery(GetPreviousPointCorrectionsDocument, {
    variables: {
      liveQuizId,
      instanceId:
        instanceScope && instanceId && instanceId !== ''
          ? parseInt(instanceId, 10)
          : undefined,
    },
    fetchPolicy: 'network-only',
    skip: !liveQuizId || liveQuizId === '',
  })
  const corrections = data?.previousPointCorrections ?? []
  const [collapsibleOpen, setCollapsibleOpen] = useState(false)

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
