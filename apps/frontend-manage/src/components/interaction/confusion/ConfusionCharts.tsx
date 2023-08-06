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
      <div className="flex justify-center items-center font-bold min-h-[355px]">
        {t('manage.cockpit.noDataYet')}
      </div>
    )
  }

  return (
    <div className="flex flex-row w-full">
      <div className="flex flex-col w-full sm:flex-row lg:flex-col ">
        <div className="w-full">
          <div className="w-full h-10 ">
            <H3 className={{ root: 'inline-block mr-2' }}>
              {t('manage.cockpit.speed')}
            </H3>
            <div className="inline-block">
              ({confusionValues.numberOfParticipants}{' '}
              {t('shared.generic.feedbacks')})
            </div>
            <Tooltip
              tooltip={t('manage.cockpit.confusionSpeedTooltip')}
              className={{
                trigger: 'block float-right sm:hidden lg:block',
                tooltip: 'max-w-[20%] md:max-w-[30%] text-sm',
              }}
              withIndicator={false}
            >
              <FontAwesomeIcon
                icon={faQuestion}
                className="w-3 h-3 p-1 mt-1 text-white border border-white border-solid rounded-full bg-primary-60"
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
          <div className="w-full h-10">
            <H3 className={{ root: 'inline-block mr-2' }}>
              {t('manage.cockpit.difficulty')}
            </H3>
            <div className="inline-block">
              ({confusionValues.numberOfParticipants}{' '}
              {t('shared.generic.feedbacks')})
            </div>
            <Tooltip
              tooltip={t('manage.cockpit.confusionDifficultyTooltip')}
              className={{
                trigger: 'block float-right sm:hidden lg:block',
                tooltip: 'max-w-[20%] md:max-w-[30%] text-sm',
              }}
              withIndicator={false}
            >
              <FontAwesomeIcon
                icon={faQuestion}
                className="w-3 h-3 p-1 mt-1 text-white border border-white border-solid rounded-full bg-primary-60"
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
