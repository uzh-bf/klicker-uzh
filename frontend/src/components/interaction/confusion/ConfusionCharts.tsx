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
    const aggrSpeed = {}
    const aggrDifficulty = {}

    const filteredConfusion = confusionTS
      .map((element: any) => ({
        speed: element.speed.toString(),
        difficulty: element.difficulty.toString(),
        timestamp: dayjs(element.createdAt),
      }))
      .filter((element: any) => dayjs().diff(element.timestamp, 'minute') <= 10)

    // TODO: rebuild this using reduce based on the above array, without needing explicit assignment in forEach
    filteredConfusion.forEach((value) => {
      aggrSpeed[value.speed] = (aggrSpeed[value.speed] || 0) + 1
      aggrDifficulty[value.difficulty] = (aggrDifficulty[value.difficulty] || 0) + 1
    })

    setSpeedRunning(
      ((aggrSpeed['0'] || 0) * 0.5 + (aggrSpeed['1'] || 0)) /
        ((aggrSpeed['-1'] || 0) + (aggrSpeed['0'] || 0) + (aggrSpeed['1'] || 0))
    )

    setDifficultyRunning(
      ((aggrDifficulty['0'] || 0) * 0.5 + (aggrDifficulty['1'] || 0)) /
        ((aggrDifficulty['-1'] || 0) + (aggrDifficulty['0'] || 0) + (aggrDifficulty['1'] || 0))
    )
  }, [confusionTS, forceRerender])

  console.log(confusionTS)
  console.log(speedRunning)
  console.log(difficultyRunning)

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
