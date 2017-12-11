import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'

import ConfusionSection from './ConfusionSection'

const propTypes = {
  confusionTS: PropTypes.arrayOf(
    PropTypes.shape({
      createdAt: PropTypes.string.isRequired,
      difficulty: PropTypes.number.isRequired,
      speed: PropTypes.number.isRequired,
    }),
  ),
  handleActiveToggle: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  isActive: PropTypes.bool,
}

const defaultProps = {
  confusionTS: [],
  isActive: false,
}

const ConfusionBarometer = ({
  confusionTS, intl, isActive, handleActiveToggle,
}) => (
  <div className="confusionBarometer">
    <h2>
      <FormattedMessage defaultMessage="Confusion-Barometer" id="runningSession.confusion.title" />
    </h2>

    <Checkbox
      toggle
      defaultChecked={isActive}
      label={intl.formatMessage({
        defaultMessage: 'Activated',
        id: 'common.string.activated',
      })}
      value={isActive}
      onChange={handleActiveToggle}
    />

    {(() => {
      if (isActive) {
        return (
          <React.Fragment>
            <ConfusionSection
              data={confusionTS.map(({ createdAt, difficulty }) => ({
                timestamp: createdAt,
                value: difficulty,
              }))}
              title={intl.formatMessage({
                defaultMessage: 'Difficulty',
                id: 'runningSession.confusion.difficulty',
              })}
            />
            <ConfusionSection
              data={confusionTS.map(({ createdAt, speed }) => ({
                timestamp: createdAt,
                value: speed,
              }))}
              title={intl.formatMessage({
                defaultMessage: 'Speed',
                id: 'runningSession.confusion.speed',
              })}
            />
          </React.Fragment>
        )
      }

      return null
    })()}

    <style jsx>{`
      @import 'src/theme';

      .confusionBarometer {
        display: flex;
        flex-direction: column;

        h2 {
          margin-bottom: 1rem;
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

ConfusionBarometer.propTypes = propTypes
ConfusionBarometer.defaultProps = defaultProps

export default ConfusionBarometer
