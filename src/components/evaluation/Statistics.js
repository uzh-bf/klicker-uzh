import React from 'react'
import PropTypes from 'prop-types'
import _round from 'lodash/round'
import { FormattedMessage } from 'react-intl'
import { Input, Popup, Icon } from 'semantic-ui-react'
import _isNumber from 'lodash/isNumber'

import { EvaluationListItem } from '.'

const propTypes = {
  bins: PropTypes.number.isRequired,
  max: PropTypes.number,
  mean: PropTypes.number,
  median: PropTypes.number,
  min: PropTypes.number,
  onChangeBins: PropTypes.func.isRequired,
  q1: PropTypes.number,
  q3: PropTypes.number,
  sd: PropTypes.number,
  withBins: PropTypes.bool,
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

const Statistics = ({ bins, max, mean, median, min, q1, q3, sd, onChangeBins, withBins }) => (
  <div className="statistics">
    <h2>
      <FormattedMessage defaultMessage="Statistics" id="evaluation.statistics.title" />
    </h2>

    <div>
      <EvaluationListItem reverse marker="MIN">
        {_isNumber(min) ? _round(min, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem reverse marker="Q1">
        {_isNumber(q1) ? _round(q1, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem reverse marker="MEDIAN">
        {_isNumber(median) ? _round(median, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem reverse marker="MEAN">
        {_isNumber(mean) ? _round(mean, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem reverse marker="Q3">
        {_isNumber(q3) ? _round(q3, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem reverse marker="MAX">
        {_isNumber(max) ? _round(max, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem reverse marker="SD">
        {_isNumber(sd) ? _round(sd, 2) : '-'}
      </EvaluationListItem>
    </div>

    {withBins && (
      <div className="bins">
        <Input fluid label="Bins" labelPosition="left" name="bins" type="number" value={bins} onChange={onChangeBins} />

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

    <style jsx>
      {`
        .statistics {
          h2 {
            font-size: 1.2rem;
            line-height: 1.2rem;
            margin-bottom: 0.5rem;
          }

          .bins {
            margin-top: 1rem;

            :global(.message) {
              margin-top: 0.5rem;
              padding: 1rem;
            }
          }
        }
      `}
    </style>
  </div>
)

Statistics.propTypes = propTypes
Statistics.defaultProps = defaultProps

export default Statistics
