import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import ConfusionSection from './ConfusionSection'
import withCSS from '../../lib/withCSS'

const ConfusionBarometer = ({ head, intl, isActive, onActiveToggle }) =>
  (<div className="confusionBarometer">
    {head}

    <h2>
      <FormattedMessage
        defaultMessage="Confusion-Barometer"
        id="runningSession.confusionBarometer.string.title"
      />
    </h2>

    <Checkbox
      toggle
      label={intl.formatMessage({
        defaultMessage: 'Activated',
        id: 'common.string.activated',
      })}
      value={isActive}
      onChange={onActiveToggle}
    />

    {isActive &&
      <ConfusionSection
        title={intl.formatMessage({
          defaultMessage: 'Difficulty',
          id: 'runningSession.confusionBarometer.string.difficulty',
        })}
        data={[
          { timestamp: '11:55', value: -10 },
          { timestamp: '11:56', value: 0 },
          { timestamp: '11:57', value: 10 },
          { timestamp: '11:58', value: 25 },
          { timestamp: '11:59', value: 50 },
          { timestamp: '12:00', value: 0 },
          { timestamp: '12:01', value: -50 },
        ]}
      />}

    {isActive &&
      <ConfusionSection
        title={intl.formatMessage({
          defaultMessage: 'Comprehensibility',
          id: 'runningSession.confusionBarometer.string.comprehensibility',
        })}
        data={[
          { timestamp: '11:55', value: 40 },
          { timestamp: '11:56', value: 30 },
          { timestamp: '11:57', value: 35 },
          { timestamp: '11:58', value: 20 },
          { timestamp: '11:59', value: 25 },
          { timestamp: '12:00', value: 50 },
          { timestamp: '12:01', value: 10 },
        ]}
      />}

    <style jsx>{`
      .confusionBarometer {
        display: flex;
        flex-direction: column;
      }

      h2 {
        margin-bottom: 1rem;
      }

      h3 {
        margin: 0 0 .5rem 0;
      }

      .confusionSection {
        flex: 1;

        background: lightgrey;
        border: 1px solid grey;
        margin-top: 1rem;
        padding: 1rem;
      }

      @media all and (min-width: 768px) {
        .confusionSection {
          padding: .5rem;
        }

        .confusionSection:last-child {
          margin-top: .5rem;
        }
      }
    `}</style>
  </div>)

ConfusionBarometer.propTypes = {
  head: PropTypes.node.isRequired, // head as injected by HOC
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  isActive: PropTypes.bool.isRequired,
  onActiveToggle: PropTypes.func.isRequired,
}

export default withCSS(ConfusionBarometer, ['checkbox'])
