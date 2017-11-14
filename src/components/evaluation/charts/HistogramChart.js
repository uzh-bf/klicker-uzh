import React from 'react'
import PropTypes from 'prop-types'
import {
  Bar,
  BarChart,
  Brush,
  ReferenceLine,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
  isSolutionShown: PropTypes.bool,
}

const defaultProps = {
  data: [],
  isSolutionShown: false,
}

const data = [
  { name: '1', uv: 300 },
  { name: '2', uv: 145 },
  { name: '3', uv: 100 },
  { name: '4', uv: 8 },
  { name: '5', uv: 100 },
  { name: '6', uv: 9 },
  { name: '7', uv: 53 },
  { name: '8', uv: 252 },
  { name: '9', uv: 79 },
  { name: '10', uv: 294 },
  { name: '12', uv: 43 },
  { name: '13', uv: 74 },
  { name: '14', uv: 71 },
  { name: '15', uv: 117 },
  { name: '16', uv: 186 },
  { name: '17', uv: 16 },
  { name: '18', uv: 125 },
  { name: '19', uv: 222 },
  { name: '20', uv: 372 },
  { name: '21', uv: 182 },
  { name: '22', uv: 164 },
  { name: '23', uv: 316 },
  { name: '24', uv: 131 },
  { name: '25', uv: 291 },
  { name: '26', uv: 47 },
  { name: '27', uv: 415 },
  { name: '28', uv: 182 },
  { name: '29', uv: 93 },
  { name: '30', uv: 99 },
  { name: '31', uv: 52 },
  { name: '32', uv: 154 },
  { name: '33', uv: 205 },
  { name: '34', uv: 70 },
  { name: '35', uv: 25 },
  { name: '36', uv: 59 },
  { name: '37', uv: 63 },
  { name: '38', uv: 91 },
  { name: '39', uv: 66 },
  { name: '40', uv: 50 },
]

const HistogramChart = () => (
  <ResponsiveContainer width="80%">
    <BarChart
      width={600}
      height={300}
      data={data}
      margin={{
        bottom: 5,
        left: 20,
        right: 30,
        top: 5,
      }}
    >
      <XAxis dataKey="name" />
      <YAxis />
      <CartesianGrid strokeDasharray="3 3" />
      <Tooltip />
      <Legend verticalAlign="top" wrapperStyle={{ lineHeight: '40px' }} />
      <ReferenceLine y={0} stroke="#000" />
      <Brush dataKey="name" height={30} stroke="#8884d8" />
      <Bar dataKey="pv" fill="#8884d8" />
      <Bar dataKey="uv" fill="#82ca9d" />
    </BarChart>
  </ResponsiveContainer>
)

HistogramChart.propTypes = propTypes
HistogramChart.defaultProps = defaultProps

export default HistogramChart
