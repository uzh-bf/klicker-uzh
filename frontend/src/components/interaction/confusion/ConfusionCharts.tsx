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

    // check if the time difference between now and a given timestamp is less than 10 minutes
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

    const difficultyEntries = tempAcc
      .filter((element: any) => {
        if (element.timestamp) {
          return compareTimeToNow(element.timestamp.split(':'), 600)
        }
      })
      .map((element: any) => element.difficulty)

    const speedEntries = tempAcc
      .filter((element: any) => {
        if (element.timestamp) {
          return compareTimeToNow(element.timestamp.split(':'), 600)
        }
      })
      .map((element: any) => element.speed)

    const reducer = (accumulator: number) => accumulator + 1
    const difficultyRunning = [
      Math.abs(difficultyEntries.filter((elem: any) => elem == -1).reduce(reducer, 0)),
      Math.abs(difficultyEntries.filter((elem: any) => elem == 0).reduce(reducer, 0)),
      Math.abs(difficultyEntries.filter((elem: any) => elem == 1).reduce(reducer, 0)),
    ]
    const speedRunning = [
      Math.abs(speedEntries.filter((elem: any) => elem == -1).reduce(reducer, 0)),
      Math.abs(speedEntries.filter((elem: any) => elem == 0).reduce(reducer, 0)),
      Math.abs(speedEntries.filter((elem: any) => elem == 1).reduce(reducer, 0)),
    ]

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
        // TODO: replace this line again by an intl string collection later on
        //xlabel={intl.formatMessage(messages.difficultyRange)}
        xlabel={['easy', 'optimal', 'hard']}
      />
      <ConfusionSection
        data={parsedTS.map(({ timestamp, speed, speedRunning }): any => ({
          timestamp,
          value: speed,
          valueRunning: speedRunning,
        }))}
        title={intl.formatMessage(messages.speedTitle)}
        // TODO: replace this line again by an intl string collection later on
        //xlabel={intl.formatMessage(messages.speedRange)}
        xlabel={['slow', 'optimal', 'fast']}
      />
    </>
  )
}

export default ConfusionCharts
