import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox, Header } from 'semantic-ui-react'

import withCSS from '../../../lib/withCSS'

const ConfusionBarometer = () => (
  <div>
    <Header dividing as="h2" content="Confusion-Barometer" />
    {/* TODO semantic-ui styling import */}
    <Checkbox toggle label="Aktiviert" />
    <div className="pace">Geschwindigkeit</div>
    <div className="comprehensibility">Verständlichkeit</div>
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
      `}</style>
  </div>
)

ConfusionBarometer.propTypes = {
  head: PropTypes.node.isRequired,
}

export default withCSS(ConfusionBarometer, ['checkbox', 'header'])
