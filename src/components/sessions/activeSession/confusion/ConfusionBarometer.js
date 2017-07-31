import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox, Header } from 'semantic-ui-react'

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
      <Header dividing as="h2" content="Confusion-Barometer" />
      {/* TODO semantic-ui styling import */}
      <Checkbox toggle label="Aktiviert" />
      <div className="pace">
        <p className="sectionTitle">Geschwindigkeit</p>
        <p>{calculateAverage(data, 'difficulty')}</p>
      </div>
      <div className="comprehensibility">
        <p className="sectionTitle">Verständlichkeit</p>
        <p>{calculateAverage(data, 'comprehensibility')}</p>
      </div>
      <style jsx>{`
        .pace {
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
