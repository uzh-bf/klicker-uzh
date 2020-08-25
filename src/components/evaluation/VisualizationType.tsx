import React from 'react'
import { Dropdown } from 'semantic-ui-react'
import { defineMessages, useIntl } from 'react-intl'

import { CHART_TYPES } from '../../constants'

const messages = defineMessages({
  title: {
    defaultMessage: 'Visualization',
    id: 'evaluation.visualization.title',
  },
})

interface Props {
  activeVisualization: string
  onChangeType: (questionType: string, value: string) => void
  questionType: string
  disabled: boolean
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
  { text: 'Scatter Chart', value: CHART_TYPES.SCATTER_CHART, withinType: [] },
]

function VisualizationType({ activeVisualization, onChangeType, questionType, disabled }: Props): React.ReactElement {
  const intl = useIntl()
  return (
    <div className="visualizationType">
      <Dropdown
        selection
        upward
        disabled={disabled}
        options={options.filter((o): boolean => o.withinType.includes(questionType))}
        placeholder={intl.formatMessage(messages.title)}
        value={activeVisualization}
        onChange={(_, { value }: { value: string }): void => onChangeType(questionType, value)}
      />
    </div>
  )
}

export default VisualizationType
