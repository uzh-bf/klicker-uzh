import React, { useEffect } from 'react'
import ConfusionCharts from './ConfusionCharts'

interface Props {
  confusionValues?: {
    speed: number
    difficulty: number
  }
  subscribeToMore?: any
}

const defaultProps = {
  confusionValues: { speed: 0.5, difficulty: 0.5 },
}

function ConfusionBarometer({ confusionValues, subscribeToMore }: Props): React.ReactElement {
  useEffect((): void => {
    if (subscribeToMore) {
      subscribeToMore()
    }
  }, [subscribeToMore])

  return <ConfusionCharts confusionValues={confusionValues} />
}

ConfusionBarometer.defaultProps = defaultProps

export default ConfusionBarometer
