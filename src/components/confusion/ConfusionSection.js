import React from 'react'
import PropTypes from 'prop-types'
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from 'recharts'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  data: LineChart.propTypes.data.isRequired,
  title: PropTypes.string.isRequired,
}

const ConfusionSection = ({ data, title }) => (
  <div className="confusionSection">
    <h3>{title}</h3>

    <div className="chart">
      {(() => {
        // if there is no data for the section, display a message
        if (data.length === 0) {
          return (
            <FormattedMessage
              defaultMessage="No data yet."
              id="runningSession.confusionSection.noData"
            />
          )
        }

        // otherwise render a chart
        return (
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <Legend />
              <XAxis dataKey="createdAt" />
              <YAxis domain={[-5, 5]} ticks={[-5, 0, 5]} />
              <ReferenceLine stroke="red" y={0} />
              <Line dataKey="value" name="value" stroke="#8884d8" type="step" />
              <Line dataKey="valueRunning" name="running average" stroke="green" type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        )
      })()}
    </div>

    <style jsx>{`
      .confusionSection {
        display: flex;
        flex-direction: column;

        height: 15rem;

        .chart {
          flex: 1;

          height: 10rem;
        }
      }
    `}</style>
  </div>
)

ConfusionSection.propTypes = propTypes

export default ConfusionSection
