import React from 'react'
import { intlShape } from 'react-intl'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// TODO
const propTypes = {
  intl: intlShape.isRequired,
  visualization: intlShape.string,
}

// TODO
const defaultProps = {
  visualization: 'pieChart',
}

const data = [
  { name: 'Group A', value: 400 },
  { name: 'Group B', value: 300 },
  { name: 'Group C', value: 300 },
  { name: 'Group D', value: 200 },
]

// TODO default value
const Graph = ({ intl, visualization }) => (
  <div className="graph">
    {visualization === 'pieChart' && (
      <ResponsiveContainer>
        <PieChart>
          <Pie
            label
            data={data}
            innerRadius={60}
            outerRadius={150}
            fill="#8884d8"
          />
        </PieChart>
      </ResponsiveContainer>
    )}
    {visualization === 'barChart' && (
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    )}
    {visualization !== 'barChart' &&
    visualization !== 'pieChart' && <div>This type of graph is not implemented yet!</div>}

    <style jsx>{`
      .title {
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .graph {
        height: 30rem;
        width: 50rem;
      }
    `}</style>
  </div>
)

Graph.propTypes = propTypes
Graph.defaultProps = defaultProps

export default Graph
