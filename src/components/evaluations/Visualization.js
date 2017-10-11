import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'

// TODO
const propTypes = {
  intl: intlShape.isRequired,
  onChangeType: PropTypes.func.isRequired,
  type: PropTypes.string,
}

// TODO
const defaultProps = {}

const dropDownOptions = [
  { text: 'Pie Chart', value: 'pieChart', withinType: ['SC'] },
  { text: 'Bar Chart', value: 'barChart', withinType: ['SC'] },
  { text: 'Word cloud', value: 'cloud', withinType: ['FREE'] },
  { text: 'Table', value: 'table', withinType: ['FREE'] },
  { text: 'Historgamm', value: 'histogramm', withinType: ['NUMBER_RANGE'] },
  { text: 'Ranking', value: 'ranking', withinType: ['NUMBER_RANGE'] },
]

const Visualization = ({ intl, onChangeType, type }) => (
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
      options={dropDownOptions.filter(o => o.withinType.indexOf(type) > -1)}
      onChange={(param, data) => onChangeType(data.value)}
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
