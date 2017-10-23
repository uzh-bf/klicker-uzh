import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'semantic-ui-react'
import { intlShape } from 'react-intl'

// TODO
const propTypes = {
  intl: intlShape.isRequired,
  onChangeType: PropTypes.func.isRequired,
  type: PropTypes.string.isRequired,
}

const options = [
  { text: 'Pie Chart', value: 'PIE_CHART', withinType: ['SC', 'MC'] },
  { text: 'Bar Chart', value: 'BAR_CHART', withinType: ['SC', 'MC'] },
  { text: 'Word cloud', value: 'WORD_CLOUD', withinType: ['FREE'] },
  { text: 'Table', value: 'TABULAR', withinType: ['SC', 'MC', 'FREE'] },
  { text: 'Histogramm', value: 'HISTOGRAM', withinType: ['FREE:RANGE'] },
  { text: 'Ranking', value: 'RANKING', withinType: ['FREE:RANGE'] },
]

const VisualizationType = ({ intl, onChangeType, type }) => (
  <div className="visualizationType">
    <Dropdown
      upward
      search
      selection
      options={options.filter(o => o.withinType.includes(type))}
      onChange={(param, data) => onChangeType(data.value)}
      placeholder={intl.formatMessage({
        defaultMessage: 'Visualization',
        id: 'teacher.evaluation.visualization.title',
      })}
    />

    <style jsx>{`
      h2 {
        font-weight: bold;
        margin-bottom: 1rem;
      }
    `}</style>
  </div>
)

VisualizationType.propTypes = propTypes

export default VisualizationType
