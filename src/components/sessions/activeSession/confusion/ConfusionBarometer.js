import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import withCSS from '../../../../lib/withCSS'

const ConfusionBarometer = ({ data }) => {
  const calculateAverage = (allData, category) => {
    const values = []
    switch (category) {
      case 'difficulty':
        allData.map(({ difficulty }) => (values.push(difficulty)))
        break
      case 'comprehensibility':
        allData.map(({ comprehensibility }) => (values.push(comprehensibility)))
        break
      default:
        break
    }
    const sum = values.reduce((previous, current) => previous + current)
    return sum / values.length
  }

  return (
    <div>
      <h2>
        {/* TODO correct naming of identifier */}
        <FormattedMessage
          defaultMessage="Confusion-Barometer"
          id="pages.runningSession.confusionBarometer.title"
        />
      </h2>
      {/* TODO semantic-ui styling import */}
      <Checkbox toggle label="Aktiviert" />
      <div className="difficulty">
        <p className="sectionTitle">
          <FormattedMessage
            defaultMessage="Difficulty"
            id="pages.runningSession.confusionBarometer.paragraph.difficulty" // TODO correct naming of identifier
          />
        </p>
        <p>{calculateAverage(data, 'difficulty')}</p>
      </div>
      <div className="comprehensibility">
        <p className="sectionTitle">
          <FormattedMessage
            defaultMessage="Verständlichkeit"
            id="pages.runningSession.confusionBarometer.paragraph.comprehensibility"
          />
        </p>
        <p>{calculateAverage(data, 'comprehensibility')}</p>
      </div>
      <style jsx>{`
        .difficulty {
          background: lightgrey;
          padding: .5rem;
          margin-top: 1rem;
        }
        .comprehensibility {
          background: grey;
          padding: .5rem;
          margin-top: 1rem;
        }
        .sectionTitle {
          font-weight: bold;
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
}

export default withCSS(ConfusionBarometer, ['checkbox', 'header'])
