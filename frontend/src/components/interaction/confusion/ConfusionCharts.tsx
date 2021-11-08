import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'

import ConfusionSection from './ConfusionSection'

const messages = defineMessages({
  difficultyRange: {
    defaultMessage: 'easy - hard',
    id: 'runningSession.confusion.difficulty.Range',
  },
  difficultyTitle: {
    defaultMessage: 'Difficulty',
    id: 'runningSession.confusion.difficulty.Title',
  },
  speedRange: {
    defaultMessage: 'slow - fast',
    id: 'runningSession.confusion.speed.Range',
  },
  speedTitle: {
    defaultMessage: 'Speed',
    id: 'runningSession.confusion.speed.Title',
  },
})

interface Props {
  confusionValues: any
  forceRerender: any
}

function ConfusionCharts({ confusionValues, forceRerender }: Props): React.ReactElement {
  const intl = useIntl()

  // TODO: check that there are values!
  if (Number.isNaN(confusionValues.speed) || Number.isNaN(confusionValues.difficulty)) {
    return (
      <div className="font-bold">
        <FormattedMessage defaultMessage="No data yet." id="runningSession.confusionSection.noData" />
      </div>
    )
  }

  return (
    <div>
      <ConfusionSection
        runningValue={confusionValues.speed}
        title={intl.formatMessage(messages.difficultyTitle)}
        xlabel={intl.formatMessage(messages.difficultyRange)}
      />
      <ConfusionSection
        runningValue={confusionValues.difficulty}
        title={intl.formatMessage(messages.speedTitle)}
        xlabel={intl.formatMessage(messages.speedRange)}
      />
    </div>
  )
}

export default ConfusionCharts
