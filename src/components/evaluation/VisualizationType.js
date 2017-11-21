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
  { text: 'Pie Chart', value: 'PIE_CHART', withinType: ['SC', 'MC', 'FREE_RANGE'] },
  { text: 'Bar Chart', value: 'BAR_CHART', withinType: ['SC', 'MC', 'FREE_RANGE'] },
  { text: 'Word Cloud', value: 'WORD_CLOUD', withinType: ['FREE', 'FREE_RANGE'] },
  { text: 'Table', value: 'TABLE', withinType: ['SC', 'MC', 'FREE', 'FREE_RANGE'] },
  { text: 'Histogram', value: 'HISTOGRAM', withinType: ['FREE_RANGE'] },
]

const VisualizationType = ({ intl, onChangeType, type }) => (
  <div className="visualizationType">
    <Dropdown
      search
      selection
      upward
      options={options.filter(o => o.withinType.includes(type))}
      placeholder={intl.formatMessage({
        defaultMessage: 'Visualization',
        id: 'teacher.evaluation.visualization.title',
      })}
      onChange={(param, data) => onChangeType(data.value)}
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
