import React from 'react'
import { Checkbox } from 'semantic-ui-react'
import { intlShape, FormattedMessage } from 'react-intl'

// TODO default toggle as props
const propTypes = {
  intl: intlShape.isRequired,
}

// TODO default toggle as props
const defaultProps = {}

// TODO default toggle as props
const SampleSolution = ({ intl }) => (
  <div className="solution">
    <div className="title">
      <FormattedMessage id="teacher.evaluation.sampleSolution.title" defaultMessage="Sample Solution" />
    </div>
    <Checkbox toggle label={intl.formatMessage({ defaultMessage: 'Show', id: 'teacher.evaluation.sampleSolution.show' })} />

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
