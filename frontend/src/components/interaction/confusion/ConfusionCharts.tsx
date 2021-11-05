import React, { useState } from 'react'
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

  // check if the time difference between now and a given timestamp is less than a specified duration in seconds
  const compareTimeToNow = (arr: any, differenceSec: number) => {
    const now = new Date()
    if (
      parseInt(arr[0]) * 60 * 60 + parseInt(arr[1]) * 60 + parseInt(arr[2]) + differenceSec <
      now.getHours() * 60 * 60 + now.getMinutes() * 60 + now.getSeconds()
    ) {
      return false
    }
    return true
  }

  // compute arrays with the aggregated values in the specified timeframe
  const aggrSpeed = {}
  const aggrDifficulty = {}
  const filteredConfusion = confusionTS
    .map((element: any) => {
      return {
        speed: element.speed.toString(),
        difficulty: element.difficulty.toString(),
        timestamp: dayjs(element.createdAt).format('H:mm:ss'),
      }
    })
    .filter((element: any) => compareTimeToNow(element.timestamp.split(':'), 600))

  filteredConfusion.forEach((value) => (aggrSpeed[value.speed] = (aggrSpeed[value.speed] || 0) + 1))
  filteredConfusion.forEach((value) => (aggrDifficulty[value.difficulty] = (aggrDifficulty[value.difficulty] || 0) + 1))

  const speedRunning = [
    aggrSpeed['-1'] ? aggrSpeed['-1'] : 0,
    aggrSpeed['0'] ? aggrSpeed['0'] : 0,
    aggrSpeed['1'] ? aggrSpeed['1'] : 0,
  ]
  const difficultyRunning = [
    aggrDifficulty['-1'] ? aggrDifficulty['-1'] : 0,
    aggrDifficulty['0'] ? aggrDifficulty['0'] : 0,
    aggrDifficulty['1'] ? aggrDifficulty['1'] : 0,
  ]
  console.log('running speed array: ' + speedRunning)
  console.log('running difficulty array: ' + difficultyRunning)

  console.log(
    'new data element: \n' +
      filteredConfusion.map((element) => [
        'speed: ' + element.speed,
        'difficulty: ' + element.difficulty,
        'timestamp: ' + element.timestamp,
        '\n',
      ])
  )

  return (
    <>
      <ConfusionSection
        data={[{ valueRunning: [0, 0, 0] }]}
        title={intl.formatMessage(messages.difficultyTitle)}
        // TODO: replace this line again by an intl string collection later on
        //xlabel={intl.formatMessage(messages.difficultyRange)}
        xlabel={['easy', 'optimal', 'hard']}
      />
      <ConfusionSection
        data={[{ valueRunning: [0, 0, 0] }]}
        title={intl.formatMessage(messages.speedTitle)}
        // TODO: replace this line again by an intl string collection later on
        //xlabel={intl.formatMessage(messages.speedRange)}
        xlabel={['slow', 'optimal', 'fast']}
      />
    </>
  )
}

export default ConfusionCharts
