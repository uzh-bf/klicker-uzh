import React from 'react'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'

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
})

interface Props {
  confusionValues: any
}

function ConfusionCharts({ confusionValues }: Props): React.ReactElement {
  const intl = useIntl()

  if (Number.isNaN(confusionValues.speed) || Number.isNaN(confusionValues.difficulty)) {
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
    <div>
      <ConfusionSection
        runningValue={confusionValues.speed}
        title={intl.formatMessage(messages.difficultyTitle)}
        labels={speedLabels}
      />
      <ConfusionSection
        runningValue={confusionValues.difficulty}
        title={intl.formatMessage(messages.speedTitle)}
        labels={difficultyLabels}
      />
    </div>
  )
}

export default ConfusionCharts
