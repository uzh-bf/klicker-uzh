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
      <FormattedMessage
        defaultMessage="Confusion-Barometer"
        id="runningSession.confusionBarometer.string.title"
      />
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

    {isActive && (
      <ConfusionSection
        title={intl.formatMessage({
          defaultMessage: 'Difficulty',
          id: 'runningSession.confusionBarometer.string.difficulty',
        })}
        data={confusionTS.map(({ createdAt, difficulty }) => ({
          timestamp: createdAt,
          value: difficulty,
        }))}
      />
    )}

    {isActive && (
      <ConfusionSection
        title={intl.formatMessage({
          defaultMessage: 'Comprehensibility',
          id: 'runningSession.confusionBarometer.string.comprehensibility',
        })}
        data={confusionTS.map(({ createdAt, speed }) => ({
          timestamp: createdAt,
          value: speed,
        }))}
      />
    )}

    <style jsx>{`
      @import 'src/theme';

      .confusionBarometer {
        display: flex;
        flex-direction: column;
      }

      h2 {
        margin-bottom: 1rem;
      }

      h3 {
        margin: 0 0 0.5rem 0;
      }

      .confusionSection {
        flex: 1;

        background: lightgrey;
        border: 1px solid grey;
        margin-top: 1rem;
        padding: 1rem;
      }

      @include desktop-tablet-only {
        .confusionSection {
          padding: 0.5rem;
        }

        .confusionSection:last-child {
          margin-top: 0.5rem;
        }
      }
    `}</style>
  </div>
)

ConfusionBarometer.propTypes = propTypes
ConfusionBarometer.defaultProps = defaultProps

export default ConfusionBarometer
