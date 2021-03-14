import React, { useEffect } from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Checkbox } from 'semantic-ui-react'
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
  handleActiveToggle: any
  subscribeToMore?: any
}

const defaultProps = {
  confusionTS: [],
  isActive: false,
}

function ConfusionBarometer({ confusionTS, isActive, handleActiveToggle, subscribeToMore }: Props): React.ReactElement {
  const intl = useIntl()

  useEffect((): void => {
    if (subscribeToMore) {
      subscribeToMore()
    }
  }, [])

  return (
    <div className="confusionBarometer">
      <h2>
        <FormattedMessage defaultMessage="Confusion-Barometer" id="runningSession.confusion.title" />
      </h2>

      <div className="infoMessage">
        <FormattedMessage
          defaultMessage="The Confusion-Barometer allows you to get feedback on the speed and difficulty of your lecture as it evolves over time."
          id="runningSession.confusion.info"
        />
      </div>

      <Checkbox
        toggle
        checked={isActive}
        defaultChecked={isActive}
        label={intl.formatMessage(messages.activated)}
        onChange={handleActiveToggle}
      />

      {isActive && <ConfusionCharts confusionTS={confusionTS} />}

      <style jsx>{`
        @import 'src/theme';

        .confusionBarometer {
          display: flex;
          flex-direction: column;

          h2 {
            margin-bottom: 0.5rem;
          }

          .infoMessage {
            color: #404040;
            margin-bottom: 0.5rem;
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
