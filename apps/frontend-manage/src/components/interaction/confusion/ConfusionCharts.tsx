import { ConfusionSummary } from '@klicker-uzh/graphql/dist/ops'
import { H3, Tooltip } from '@uzh-bf/design-system'
import React from 'react'

import { faQuestion } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ConfusionSection from './ConfusionSection'

interface Props {
  confusionValues?: ConfusionSummary
}

function ConfusionCharts({ confusionValues }: Props): React.ReactElement {
  const t = useTranslations()
  const router = useRouter()

  if (
    !confusionValues ||
    Number.isNaN(confusionValues.speed) ||
    Number.isNaN(confusionValues.difficulty) ||
    !confusionValues.numberOfParticipants
  ) {
    return (
      <div className="flex min-h-[355px] items-center justify-center font-bold">
        {t('manage.cockpit.noDataYet')}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-row">
      <div className="flex w-full flex-col sm:flex-row lg:flex-col">
        <div className="w-full">
          <div className="h-10 w-full">
            <H3 className={{ root: 'mr-2 inline-block' }}>
              {t('manage.cockpit.speed')}
            </H3>
            <div className="inline-block">
              ({confusionValues.numberOfParticipants}{' '}
              {t('shared.generic.feedbacks')})
            </div>
            <Tooltip
              tooltip={t('manage.cockpit.confusionSpeedTooltip')}
              className={{
                trigger: 'float-right block sm:hidden lg:block',
                tooltip: 'max-w-[20%] text-sm md:max-w-[30%]',
              }}
              withIndicator={false}
            >
              <FontAwesomeIcon
                icon={faQuestion}
                className="bg-primary-60 mt-1 h-3 w-3 rounded-full border border-solid border-white p-1 text-white"
              />
            </Tooltip>
          </div>
          <ConfusionSection
            key={router.locale}
            labels={{
              min: t('manage.cockpit.confusionSlow'),
              mid: t('manage.cockpit.confusionOptimal'),
              max: t('manage.cockpit.confusionFast'),
            }}
            runningValue={confusionValues.speed}
          />
        </div>
        <div className="w-full">
          <div className="h-10 w-full">
            <H3 className={{ root: 'mr-2 inline-block' }}>
              {t('manage.cockpit.difficulty')}
            </H3>
            <div className="inline-block">
              ({confusionValues.numberOfParticipants}{' '}
              {t('shared.generic.feedbacks')})
            </div>
            <Tooltip
              tooltip={t('manage.cockpit.confusionDifficultyTooltip')}
              className={{
                trigger: 'float-right block sm:hidden lg:block',
                tooltip: 'max-w-[20%] text-sm md:max-w-[30%]',
              }}
              withIndicator={false}
            >
              <FontAwesomeIcon
                icon={faQuestion}
                className="bg-primary-60 mt-1 h-3 w-3 rounded-full border border-solid border-white p-1 text-white"
              />
            </Tooltip>
          </div>
          <ConfusionSection
            key={router.locale}
            labels={{
              min: t('manage.cockpit.confusionEasy'),
              mid: t('manage.cockpit.confusionOptimal'),
              max: t('manage.cockpit.confusionDifficult'),
            }}
            runningValue={confusionValues.difficulty}
          />
        </div>
      </div>
    </div>
  )
}

export default ConfusionCharts
