import React, { useEffect, useState } from 'react'
import { defineMessages } from 'react-intl'
import ConfusionCharts from './ConfusionCharts'

const messages = defineMessages({
  activated: {
    defaultMessage: 'Activated',
    id: 'common.string.activated',
  },
})

interface Props {
  confusionValues?: {
    speed: number
    difficulty: number
  }
  subscribeToMore?: any
}

const defaultProps = {
  confusionTS: [],
}

function ConfusionBarometer({ confusionValues, subscribeToMore }: Props): React.ReactElement {
  const [forceRerender, setForceRerender] = useState(0)

  useEffect(() => {
    const timeoutHandle = window.setTimeout(() => {
      window.clearTimeout(timeoutHandle)
      setForceRerender(forceRerender + 1)
    }, 60000)
    return () => {
      window.clearTimeout(timeoutHandle)
    }
  })

  // useEffect((): void => {
  //   if (subscribeToMore) {
  //     subscribeToMore()
  //   }
  // }, [subscribeToMore])

  return <ConfusionCharts confusionValues={confusionValues} forceRerender={forceRerender} />
}

ConfusionBarometer.defaultProps = defaultProps

export default ConfusionBarometer
