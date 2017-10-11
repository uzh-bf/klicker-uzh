import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { intlShape, FormattedMessage } from 'react-intl'

const propTypes = {
  intl: intlShape.isRequired,
  onChange: PropTypes.func.isRequired,
}

// TODO default toggle as props
const defaultProps = {}

// TODO default toggle as props
const SampleSolution = ({ intl, onChange }) => (
  <div className="solution">
    <div className="title">
      <FormattedMessage
        id="teacher.evaluation.sampleSolution.title"
        defaultMessage="Sample Solution"
      />
    </div>
    <Checkbox
      toggle
      label={intl.formatMessage({
        defaultMessage: 'Show',
        id: 'teacher.evaluation.sampleSolution.show',
      })}
      onChange={(param, data) => onChange(data.value)}
    />

    <style jsx>{`
      .title {
        font-weight: bold;
        margin-bottom: 1rem;
      }
    `}</style>
  </div>
)

SampleSolution.propTypes = propTypes
SampleSolution.defaultProps = defaultProps

export default SampleSolution
