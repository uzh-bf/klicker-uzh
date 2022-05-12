import React from 'react'
import _round from 'lodash/round'
import { FormattedMessage } from 'react-intl'
import { Input, Popup, Icon } from 'semantic-ui-react'
import _isNumber from 'lodash/isNumber'

import EvaluationListItem from './EvaluationListItem'

interface Props {
  bins: number
  max?: number
  mean?: number
  median?: number
  min?: number
  onChangeBins: any
  q1?: number
  q3?: number
  sd?: number
  withBins?: boolean
}

const defaultProps = {
  max: undefined,
  mean: undefined,
  median: undefined,
  min: undefined,
  q1: undefined,
  q3: undefined,
  sd: undefined,
  withBins: false,
}

function Statistics({ bins, max, mean, median, min, q1, q3, sd, onChangeBins, withBins }: Props): React.ReactElement {
  return (
    <div className="statistics">
      <div className="mb-1.5 text-xl font-bold">
        <FormattedMessage defaultMessage="Statistics" id="evaluation.statistics.title" />
      </div>

      <div>
        <EvaluationListItem reverse marker="MIN">
          {_isNumber(min) ? _round(min, 2).toString() : '-'}
        </EvaluationListItem>
        <EvaluationListItem reverse marker="Q1">
          {_isNumber(q1) ? _round(q1, 2).toString() : '-'}
        </EvaluationListItem>
        <EvaluationListItem reverse marker="MEDIAN">
          {_isNumber(median) ? _round(median, 2).toString() : '-'}
        </EvaluationListItem>
        <EvaluationListItem reverse marker="MEAN">
          {_isNumber(mean) ? _round(mean, 2).toString() : '-'}
        </EvaluationListItem>
        <EvaluationListItem reverse marker="Q3">
          {_isNumber(q3) ? _round(q3, 2).toString() : '-'}
        </EvaluationListItem>
        <EvaluationListItem reverse marker="MAX">
          {_isNumber(max) ? _round(max, 2).toString() : '-'}
        </EvaluationListItem>
        <EvaluationListItem reverse marker="SD">
          {_isNumber(sd) ? _round(sd, 2).toString() : '-'}
        </EvaluationListItem>
      </div>

      {withBins && (
        <div className="mt-4">
          <Input
            fluid
            label="Bins"
            labelPosition="left"
            name="bins"
            type="number"
            value={bins}
            onChange={onChangeBins}
          />

          <Popup wide position="bottom right" trigger={<Icon name="info circle" />}>
            <Popup.Content>
              <FormattedMessage
                defaultMessage="Type a number to override Freedman-Diaconis thresholding. The threshold defines the number of bins displayed in the histogram."
                id="evaluation.bins.description"
              />
            </Popup.Content>
          </Popup>
        </div>
      )}
    </div>
  )
}

Statistics.defaultProps = defaultProps

export default Statistics
