import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Icon } from 'semantic-ui-react'

import CustomTooltip from '../../common/CustomTooltip'
import ConfusionSection from './ConfusionSection'

const messages = defineMessages({
  difficultyRangeMin: {
    defaultMessage: 'easy',
    id: 'runningSession.confusion.difficulty.RangeMin',
  },
  difficultyRangeMid: {
    defaultMessage: 'optimal',
    id: 'runningSession.confusion.difficulty.RangeMid',
  },
  difficultyRangeMax: {
    defaultMessage: 'difficult',
    id: 'runningSession.confusion.difficulty.RangeMax',
  },
  difficultyTitle: {
    defaultMessage: 'Difficulty',
    id: 'runningSession.confusion.difficulty.Title',
  },
  speedRangeMin: {
    defaultMessage: 'slow',
    id: 'runningSession.confusion.speed.RangeMin',
  },
  speedRangeMid: {
    defaultMessage: 'optimal',
    id: 'runningSession.confusion.speed.RangeMid',
  },
  speedRangeMax: {
    defaultMessage: 'fast',
    id: 'runningSession.confusion.speed.RangeMax',
  },
  speedTitle: {
    defaultMessage: 'Speed',
    id: 'runningSession.confusion.speed.Title',
  },
  confusionInfo: {
    defaultMessage:
      'The Confusion-Barometer allows you to get feedback on the speed and difficulty of your lecture as it evolves over time.',
    id: 'runningSession.confusion.info',
  },
})

interface Props {
  confusionValues: any
}

function ConfusionCharts({ confusionValues }: Props): React.ReactElement {
  const intl = useIntl()

  if (!confusionValues || Number.isNaN(confusionValues.speed) || Number.isNaN(confusionValues.difficulty)) {
    return (
      <div className="font-bold">
        <FormattedMessage defaultMessage="No data yet." id="runningSession.confusionSection.noData" />
      </div>
    )
  }

  const tooltipConfusion = (
    <CustomTooltip
      tooltip={intl.formatMessage(messages.confusionInfo)}
      tooltipStyle={'text-sm md:text-base max-w-[45%] md:max-w-[60%]'}
      withArrow={false}
    >
      <Icon className="!ml-2" color="blue" name="question circle" />
    </CustomTooltip>
  )

  const speedLabels = {
    min: intl.formatMessage(messages.speedRangeMin),
    mid: intl.formatMessage(messages.speedRangeMid),
    max: intl.formatMessage(messages.speedRangeMax),
  }
  const difficultyLabels = {
    min: intl.formatMessage(messages.difficultyRangeMin),
    mid: intl.formatMessage(messages.difficultyRangeMid),
    max: intl.formatMessage(messages.difficultyRangeMax),
  }

  return (
    <div className="flex flex-row w-full">
      <div className="flex flex-col w-full sm:flex-row lg:flex-col ">
        <div className="w-full">
          <div className="w-full h-10 ">
            <h3 className="inline-block mr-2">{intl.formatMessage(messages.speedTitle)}</h3>
            <div className="inline-block">({confusionValues.numOfFeedbacks} Feedbacks)</div>
            <div className="block float-right sm:hidden lg:block">{tooltipConfusion}</div>
          </div>
          <ConfusionSection labels={speedLabels} runningValue={confusionValues.speed} />
        </div>
        <div className="w-full">
          <div className="w-full h-10">
            <h3 className="inline-block mr-2">{intl.formatMessage(messages.difficultyTitle)}</h3>
            <div className="inline-block">({confusionValues.numOfFeedbacks} Feedbacks)</div>
            <div className="hidden float-right sm:block lg:hidden">{tooltipConfusion}</div>
          </div>
          <ConfusionSection labels={difficultyLabels} runningValue={confusionValues.difficulty} />
        </div>
      </div>
    </div>
  )
}

export default ConfusionCharts
