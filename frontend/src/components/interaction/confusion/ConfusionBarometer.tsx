import React, { useEffect } from 'react'
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
  }, [subscribeToMore])

  return (
    <div className="confusionBarometer">
      <div className="mb-4 infoMessage">
        <FormattedMessage
          defaultMessage="The Confusion-Barometer allows you to get feedback on the speed and difficulty of your lecture as it evolves over time. It displays all feedbacks that were shared by students throughout the past 10 minutes"
          id="runningSession.confusion.info"
        />
      </div>

      <div className="mb-4">
        <Checkbox
          toggle
          checked={isActive}
          defaultChecked={isActive}
          label={intl.formatMessage(messages.activated)}
          onChange={handleActiveToggle}
        />
      </div>
      <div className="flex flex-row">{isActive && <ConfusionCharts confusionTS={confusionTS} />}</div>

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
