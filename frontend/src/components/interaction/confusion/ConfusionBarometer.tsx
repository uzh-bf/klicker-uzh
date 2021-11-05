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
  isActive?: boolean

  subscribeToMore?: any
}

const defaultProps = {
  confusionTS: [],
  isActive: false,
}

function ConfusionBarometer({ confusionTS, isActive, subscribeToMore }: Props): React.ReactElement {
  const intl = useIntl()
  const [forceRerender, setForceRerender] = useState(0)

  useEffect((): void => {
    if (subscribeToMore) {
      subscribeToMore()
    }
  }, [subscribeToMore])

  // force rerender the charts once every minute
  useEffect(() => {
    const timeoutHandle = window.setTimeout(() => {
      window.clearTimeout(timeoutHandle)
      setForceRerender(forceRerender + 1)
    }, 60000)
  })

  return (
    <div className="confusionBarometer">
      <div className="mb-4 infoMessage">
        <FormattedMessage
          defaultMessage="The Confusion-Barometer allows you to get feedback on the speed and difficulty of your lecture as it evolves over time. It displays all feedbacks that were shared by students throughout the past 10 minutes"
          id="runningSession.confusion.info"
        />
      </div>

      <div className="flex flex-row">
        {isActive && confusionTS.length !== 0 && (
          <div className="mt-4">
            <ConfusionCharts confusionTS={confusionTS} forceRerender={forceRerender} />
          </div>
        )}
        {isActive && confusionTS.length === 0 && (
          <div className="font-bold">
            <FormattedMessage defaultMessage="No data yet." id="runningSession.confusionSection.noData" />
          </div>
        )}
      </div>

      <style jsx>{`
        @import 'src/theme';

        .confusionBarometer {
          display: flex;
          flex-direction: column;

          .infoMessage {
            color: #404040;
          }

          h3 {
            margin: 0 0 0.5rem 0;
          }

          :global(.checkbox) {
            margin-bottom: 1rem;
          }

          .confusionSection {
            flex: 1;

            background: lightgrey;
            border: 1px solid grey;
            margin-top: 1rem;
            padding: 1rem;

            @include desktop-tablet-only {
              padding: 0.5rem;

              &:last-child {
                margin-top: 0.5rem;
              }
            }
          }
        }
      `}</style>
    </div>
  )
}

ConfusionBarometer.defaultProps = defaultProps

export default ConfusionBarometer
