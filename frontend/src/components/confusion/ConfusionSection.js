import React from 'react'
import PropTypes from 'prop-types'
import {
  LineChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const ConfusionSection = ({ data, title }) =>
  (<div className="confusionSection">
    <h3>
      {title}
    </h3>

    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="timestamp" />
          <YAxis />
          <Tooltip />
          <ReferenceLine y={0} stroke="red" />
          <Line type="monotone" dataKey="value" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>

    <style jsx>{`
      .confusionSection {
        display: flex;
        flex-direction: column;
      }

      .chart {
        flex: 1;

        height: 10rem;
      }
    `}</style>
  </div>)

ConfusionSection.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    }),
  ).isRequired,
  title: PropTypes.string.isRequired,
}

export default ConfusionSection
