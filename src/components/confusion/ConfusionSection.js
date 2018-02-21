import React from 'react'
import PropTypes from 'prop-types'
import {
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Label,
} from 'recharts'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  data: LineChart.propTypes.data.isRequired,
  title: PropTypes.string.isRequired,
  ylabel: PropTypes.string.isRequired,
}

const ConfusionSection = ({ data, title, ylabel }) => (
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
                bottom: 0,
                left: 0,
                right: 0,
                top: 0,
              }}
            >
              <CartesianGrid strokeDasharray="5 5" />
              <XAxis dataKey="timestamp" padding={{ right: 10 }} />
              <YAxis
                domain={[-5, 5]}
                minTickGap={1}
                padding={{ bottom: 10, top: 10 }}
                ticks={[-5, -2.5, 0, 2.5, 5]}
              >
                <Label
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: 'middle' }}
                  value={ylabel}
                />
              </YAxis>
              <ReferenceLine stroke="black" y={0} />
              <Line dataKey="value" stroke="lightgrey" type="monotone" />
              <Line dataKey="valueRunning" name="running average" stroke="green" type="monotone" />
              <Legend />
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
