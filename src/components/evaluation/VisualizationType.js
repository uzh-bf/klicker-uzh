import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'semantic-ui-react'
import { defineMessages, intlShape } from 'react-intl'

import { CHART_TYPES } from '../../constants'

const messages = defineMessages({
  title: {
    defaultMessage: 'Visualization',
    id: 'evaluation.visualization.title',
  },
})

// TODO
const propTypes = {
  activeVisualization: PropTypes.string.isRequired,
  intl: intlShape.isRequired,
  onChangeType: PropTypes.func.isRequired,
  questionType: PropTypes.string.isRequired,
}

const options = [
  { text: 'Pie Chart', value: CHART_TYPES.PIE_CHART, withinType: ['SC'] },
  {
    text: 'Bar Chart',
    value: CHART_TYPES.BAR_CHART,
    withinType: ['SC', 'MC', 'FREE_RANGE'],
  },
  { text: 'Stacked Chart', value: CHART_TYPES.STACK_CHART, withinType: ['MC'] },
  {
    text: 'Word Cloud',
    value: CHART_TYPES.CLOUD_CHART,
    withinType: ['FREE', 'FREE_RANGE'],
  },
  {
    text: 'Table',
    value: CHART_TYPES.TABLE,
    withinType: ['SC', 'MC', 'FREE', 'FREE_RANGE'],
  },
  { text: 'Histogram', value: CHART_TYPES.HISTOGRAM, withinType: ['FREE_RANGE'] },
]

const VisualizationType = ({ activeVisualization, intl, onChangeType, questionType }) => (
  <div className="visualizationType">
    <Dropdown
      selection
      upward
      options={options.filter(o => o.withinType.includes(questionType))}
      placeholder={intl.formatMessage(messages.title)}
      value={activeVisualization}
      onChange={(param, { value }) => onChangeType(questionType, value)}
    />
  </div>
)

VisualizationType.propTypes = propTypes

export default VisualizationType
