import React from 'react'
import PropTypes from 'prop-types'
import _round from 'lodash/round'
import { Icon, List } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  max: PropTypes.number.isRequired,
  mean: PropTypes.number.isRequired,
  median: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
}

const Statistics = ({
  max, mean, median, min,
}) => (
  <div className="statistics">
    <h2>
      <FormattedMessage defaultMessage="Statistics" id="teacher.evaluation.statistics.title" />
    </h2>

    <List celled>
      <List.Item>
        <List.Header>Minimum</List.Header>
        {_round(min, 2)}
      </List.Item>
      <List.Item>
        <List.Header>Maximum</List.Header>
        {_round(max, 2)}
      </List.Item>
      <List.Item>
        <List.Header>
          Mean <Icon name="square" color="blue" />
        </List.Header>
        {_round(mean, 2)}
      </List.Item>
      <List.Item>
        <List.Header>
          Median <Icon name="square" color="red" />
        </List.Header>
        {_round(median, 2)}
      </List.Item>
    </List>

    <style jsx>{`
      .statistics {
        h2 {
          font-size: 1.3rem;
          line-height: 1.3rem;
        }
      }
    `}</style>
  </div>
)

Statistics.propTypes = propTypes

export default Statistics
