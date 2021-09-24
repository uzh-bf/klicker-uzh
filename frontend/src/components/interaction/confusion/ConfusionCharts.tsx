import React from 'react'
import _sumBy from 'lodash/sumBy'
import dayjs from 'dayjs'
import { defineMessages, useIntl } from 'react-intl'

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
}

function ConfusionCharts({ confusionTS }: Props): React.ReactElement {
  const intl = useIntl()

  const parsedTS = confusionTS.reduce((acc, { createdAt, speed, difficulty }): any[] => {
    const tempAcc = [...acc, { difficulty, speed }]

    // calculate the running average for difficulty and speed
    const difficultyRunning = _sumBy(tempAcc, 'difficulty') / tempAcc.length
    const speedRunning = _sumBy(tempAcc, 'speed') / tempAcc.length

    return [
      ...acc,
      {
        difficulty,
        difficultyRunning,
        speed,
        speedRunning,
        timestamp: dayjs(createdAt).format('H:mm:ss'),
      },
    ]
  }, [])

  return (
    <>
      <ConfusionSection
        data={parsedTS.map(({ timestamp, difficulty, difficultyRunning }): any => ({
          timestamp,
          value: difficulty,
          valueRunning: difficultyRunning,
        }))}
        title={intl.formatMessage(messages.difficultyTitle)}
        ylabel={intl.formatMessage(messages.difficultyRange)}
      />
      <ConfusionSection
        data={parsedTS.map(({ timestamp, speed, speedRunning }): any => ({
          timestamp,
          value: speed,
          valueRunning: speedRunning,
        }))}
        title={intl.formatMessage(messages.speedTitle)}
        ylabel={intl.formatMessage(messages.speedRange)}
      />
    </>
  )
}

export default ConfusionCharts
