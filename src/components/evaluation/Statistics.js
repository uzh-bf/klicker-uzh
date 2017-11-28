import React from 'react'
import PropTypes from 'prop-types'
import _round from 'lodash/round'
import { FormattedMessage } from 'react-intl'

import { EvaluationListItem } from '.'

const propTypes = {
  max: PropTypes.number,
  mean: PropTypes.number,
  median: PropTypes.number,
  min: PropTypes.number,
}

const defaultProps = {
  max: undefined,
  mean: undefined,
  median: undefined,
  min: undefined,
}

const Statistics = ({
  max, mean, median, min,
}) => (
  <div className="statistics">
    <h2>
      <FormattedMessage defaultMessage="Statistics" id="teacher.evaluation.statistics.title" />
    </h2>

    <div>
      <EvaluationListItem color="white" marker="MIN">
        {min ? _round(min, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem color="white" marker="MAX">
        {max ? _round(max, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem color="Blue" marker="MEAN">
        {mean ? _round(mean, 2) : '-'}
      </EvaluationListItem>
      <EvaluationListItem color="red" marker="MEDIAN">
        {median ? _round(median, 2) : '-'}
      </EvaluationListItem>
    </div>

    <style jsx>{`
      .statistics {
        h2 {
          font-size: 1.2rem;
          line-height: 1.2rem;
          margin-bottom: 0.5rem;
        }
      }
    `}</style>
  </div>
)

Statistics.propTypes = propTypes
Statistics.defaultProps = defaultProps

export default Statistics
