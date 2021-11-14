import React from 'react'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'
import { Icon, Popup } from 'semantic-ui-react'

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
    <div className="w-full">
      <div className="float-right">
        <Popup
          inverted
          wide
          content={intl.formatMessage(messages.confusionInfo)}
          mouseEnterDelay={250}
          mouseLeaveDelay={250}
          position="left center"
          size="small"
          style={{ opacity: 0.9 }}
          trigger={
            <a data-tip>
              <Icon className="icon" name="question circle" />
            </a>
          }
        />
      </div>
      <div className="w-full">
        <ConfusionSection
          labels={speedLabels}
          runningValue={confusionValues.speed}
          title={intl.formatMessage(messages.difficultyTitle)}
        />
        <ConfusionSection
          labels={difficultyLabels}
          runningValue={confusionValues.difficulty}
          title={intl.formatMessage(messages.speedTitle)}
        />
      </div>
    </div>
  )
}

export default ConfusionCharts
