import { AggregatedConfusionFeedbacks } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import React from 'react'
// import { Icon } from 'semantic-ui-react'

// import CustomTooltip from '../../common/CustomTooltip'
import ConfusionSection from './ConfusionSection'

interface Props {
  confusionValues?: AggregatedConfusionFeedbacks
}

function ConfusionCharts({ confusionValues }: Props): React.ReactElement {
  if (
    !confusionValues ||
    Number.isNaN(confusionValues.speed) ||
    Number.isNaN(confusionValues.difficulty) ||
    !confusionValues.numberOfParticipants
  ) {
    return (
      <div className="flex justify-center items-center font-bold min-h-[355px]">
        Noch keine Daten verfügbar.
      </div>
    )
  }

  // const tooltipConfusion = (
  //   <CustomTooltip
  //     tooltip={intl.formatMessage(messages.confusionInfo)}
  //     tooltipStyle={'text-sm md:text-base max-w-[45%] md:max-w-[60%]'}
  //     withArrow={false}
  //   >
  //     <Icon className="!ml-2" color="blue" name="question circle" />
  //   </CustomTooltip>
  // )

  const speedLabels = {
    min: 'langsam',
    mid: 'optimal',
    max: 'schnell',
  }
  const difficultyLabels = {
    min: 'einfach',
    mid: 'optimal',
    max: 'schwer',
  }

  return (
    <div className="flex flex-row w-full">
      <div className="flex flex-col w-full sm:flex-row lg:flex-col ">
        <div className="w-full">
          <div className="w-full h-10 ">
            <H3 className={{ root: 'inline-block mr-2' }}>Geschwindigkeit</H3>
            <div className="inline-block">
              ({confusionValues.numberOfParticipants} Feedbacks)
            </div>
            <div className="block float-right sm:hidden lg:block">Tooltip</div>
            {/* // TODO: add tooltip */}
          </div>
          <ConfusionSection
            labels={speedLabels}
            runningValue={confusionValues.speed}
          />
        </div>
        <div className="w-full">
          <div className="w-full h-10">
            <H3 className={{ root: 'inline-block mr-2' }}>Schwierigkeit</H3>
            <div className="inline-block">
              ({confusionValues.numberOfParticipants} Feedbacks)
            </div>
            <div className="hidden float-right sm:block lg:hidden">Tooltip</div>
            {/* // TODO add tooltip */}
          </div>
          <ConfusionSection
            labels={difficultyLabels}
            runningValue={confusionValues.difficulty}
          />
        </div>
      </div>
    </div>
  )
}

export default ConfusionCharts
