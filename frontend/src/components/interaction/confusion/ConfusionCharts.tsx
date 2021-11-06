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
  confusionTS: any[]
  forceRerender: any
}

function ConfusionCharts({ confusionTS, forceRerender }: Props): React.ReactElement {
  const intl = useIntl()
  const [speedRunning, setSpeedRunning] = useState(0)
  const [difficultyRunning, setDifficultyRunning] = useState(0)

  useEffect(() => {
    const filteredConfusion = confusionTS.filter(
      (element: any) => dayjs().diff(dayjs(element.createdAt), 'minute') <= 10
    )
    const reducerSpeed = (previousValue, currentValue) => previousValue + (currentValue.speed + 1) * 0.5
    const reducerDifficulty = (previousValue, currentValue) => previousValue + (currentValue.difficulty + 1) * 0.5
    setSpeedRunning(filteredConfusion.reduce(reducerSpeed, 0) / filteredConfusion.length)
    setDifficultyRunning(filteredConfusion.reduce(reducerDifficulty, 0) / filteredConfusion.length)
  }, [confusionTS, forceRerender])

  if (confusionTS.length === 0 || isNaN(speedRunning) || isNaN(difficultyRunning)) {
    return (
      <div className="font-bold">
        <FormattedMessage defaultMessage="No data yet." id="runningSession.confusionSection.noData" />
      </div>
    )
  }

  return (
    <div>
      <ConfusionSection
        runningValue={speedRunning}
        title={intl.formatMessage(messages.difficultyTitle)}
        xlabel={intl.formatMessage(messages.difficultyRange)}
      />
      <ConfusionSection
        runningValue={difficultyRunning}
        title={intl.formatMessage(messages.speedTitle)}
        xlabel={intl.formatMessage(messages.speedRange)}
      />
    </div>
  )
}

export default ConfusionCharts
