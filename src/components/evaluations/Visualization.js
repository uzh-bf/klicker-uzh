import React from 'react'
import { Dropdown } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'

// TODO
const propTypes = {
  intl: intlShape.isRequired,
}

// TODO
const defaultProps = {}

const dropDownOptions = [
  { text: 'Pie Chart', value: 'pie' },
  { text: 'Bar Chart', value: 'bar' },
  { text: 'Word cloud', value: 'cloud' },
  { text: 'Table', value: 'table' },
  { text: 'Historgamm', value: 'histogramm' },
  { text: 'Ranking', value: 'ranking' },
]

// TODO default value
const Visualization = ({ intl }) => (
  <div className="visualization">
    <div className="title">
      <FormattedMessage
        id="teacher.evaluation.visualization.title"
        defaultMessage="Visualization"
      />
    </div>
    <Dropdown
      search
      selection
      options={dropDownOptions}
      placeholder={intl.formatMessage({
        defaultMessage: 'Visualization',
        id: 'teacher.evaluation.visualization.title',
      })}
    />

    <style jsx>{`
      .title {
        font-weight: bold;
        margin-bottom: 1rem;
      }
    `}</style>
  </div>
)

Visualization.propTypes = propTypes
Visualization.defaultProps = defaultProps

export default Visualization
