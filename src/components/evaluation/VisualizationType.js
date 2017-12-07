import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'semantic-ui-react'
import { intlShape } from 'react-intl'

// TODO
const propTypes = {
  activeVisualization: PropTypes.string.isRequired,
  intl: intlShape.isRequired,
  onChangeType: PropTypes.func.isRequired,
  questionType: PropTypes.string.isRequired,
}

const options = [
  { text: 'Pie Chart', value: 'PIE_CHART', withinType: ['SC'] },
  { text: 'Bar Chart', value: 'BAR_CHART', withinType: ['SC', 'MC'] },
  { text: 'Stacked Chart', value: 'STACK_CHART', withinType: ['MC'] },
  { text: 'Word Cloud', value: 'WORD_CLOUD', withinType: ['FREE', 'FREE_RANGE'] },
  { text: 'Table', value: 'TABLE', withinType: ['SC', 'MC', 'FREE', 'FREE_RANGE'] },
  { text: 'Histogram', value: 'HISTOGRAM', withinType: ['FREE_RANGE'] },
]

const VisualizationType = ({
  activeVisualization, intl, onChangeType, questionType,
}) => (
  <div className="visualizationType">
    <Dropdown
      selection
      upward
      options={options.filter(o => o.withinType.includes(questionType))}
      placeholder={intl.formatMessage({
        defaultMessage: 'Visualization',
        id: 'teacher.evaluation.visualization.title',
      })}
      value={activeVisualization}
      onChange={(param, data) => onChangeType(questionType, data.value)}
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
