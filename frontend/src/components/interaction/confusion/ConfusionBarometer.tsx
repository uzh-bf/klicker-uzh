import React, { useEffect, useState } from 'react'
import { Checkbox } from 'semantic-ui-react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import ConfusionCharts from './ConfusionCharts'

const messages = defineMessages({
  activated: {
    defaultMessage: 'Activated',
    id: 'common.string.activated',
  },
})

interface Props {
  confusionTS?: {
    createdAt: string
    difficulty: number
    speed: number
  }[]
  subscribeToMore?: any
}

const defaultProps = {
  confusionTS: [],
}

function ConfusionBarometer({ confusionTS, subscribeToMore }: Props): React.ReactElement {
  useEffect((): void => {
    if (subscribeToMore) {
      subscribeToMore()
    }
  }, [subscribeToMore])

  return <ConfusionCharts confusionTS={confusionTS} />
}

ConfusionBarometer.defaultProps = defaultProps

export default ConfusionBarometer
