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

// FIXME: only activate bar and pie charts for FREE:RANGE
const options = [
  { text: 'Pie Chart', value: 'PIE_CHART', withinType: ['SC', 'MC', 'FREE', 'FREE:RANGE'] },
  { text: 'Bar Chart', value: 'BAR_CHART', withinType: ['SC', 'MC', 'FREE', 'FREE:RANGE'] },
  { text: 'Word cloud', value: 'WORD_CLOUD', withinType: ['FREE'] },
  { text: 'Table', value: 'TABLE', withinType: ['SC', 'MC', 'FREE', 'FREE:RANGE'] },
  { text: 'Histogramm', value: 'HISTOGRAM', withinType: ['FREE:RANGE'] },
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
