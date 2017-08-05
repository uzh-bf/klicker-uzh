import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import _meanBy from 'lodash/meanBy'

import withCSS from '../../../../lib/withCSS'

const ConfusionBarometer = ({ data, head, intl }) => {
  // calculate means for difficulty and comprehensibility
  // TODO: might do this server-side (caching?)

  const difficultyAverage = _meanBy(data, item => item.difficulty)
  const comprehensibilityAverage = _meanBy(data, item => item.comprehensibility)

  return (
    <div className="confusionBarometer">
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
      />

      <div className="confusionSection">
        <h3>
          <FormattedMessage
            defaultMessage="Difficulty"
            id="runningSession.confusionBarometer.string.difficulty"
          />
        </h3>
        <span>
          {difficultyAverage}
        </span>
      </div>

      <div className="confusionSection">
        <h3>
          <FormattedMessage
            defaultMessage="Verständlichkeit"
            id="runningSession.confusionBarometer.string.comprehensibility"
          />
        </h3>
        <span>
          {comprehensibilityAverage}
        </span>
      </div>

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
    </div>
  )
}

ConfusionBarometer.propTypes = {
  data: PropTypes.arrayOf({
    content: PropTypes.string,
    id: PropTypes.string,
    votes: PropTypes.number,
  }).isRequired,
  head: PropTypes.node.isRequired, // head as injected by HOC
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
}

export default withCSS(ConfusionBarometer, ['checkbox'])
