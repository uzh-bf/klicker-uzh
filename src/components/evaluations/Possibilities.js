import React from 'react'
import { Dropdown } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'

// TODO
const propTypes = {
  intl: intlShape.isRequired,
}

// TODO
const defaultProps = {}

// TODO default value
const Possibilities = ({ intl }) => (
  <div className="visualization">
    <div className="title">
      <FormattedMessage
        id="teacher.evaluation.possibilities.title"
        defaultMessage="Possibilities"
      />
    </div>
    <style jsx>{`
      .title {
        font-weight: bold;
        margin-bottom: 1rem;
      }
    `}</style>
  </div>
)

Possibilities.propTypes = propTypes
Possibilities.defaultProps = defaultProps

export default Possibilities
