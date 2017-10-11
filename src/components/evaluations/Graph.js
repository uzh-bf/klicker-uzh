import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  showSolution: PropTypes.BOOLEAN,
  visualization: PropTypes.string,
}

// TODO
const defaultProps = {
  showSolution: true,
  visualization: 'pieChart',
}

const data = [
  { name: 'Group A', numberOfVotes: 400 },
  { name: 'Group B', numberOfVotes: 300 },
  { name: 'Group C', numberOfVotes: 300 },
  { name: 'Group D', numberOfVotes: 200 },
]

const correctSolution = 'Group B'

// TODO default value
const Graph = ({ intl, showSolution, visualization }) => (
  <div className="graph">
    {visualization === 'pieChart' && (
      <ResponsiveContainer>
        <PieChart>
          <Pie
            label
            data={data}
            innerRadius={60}
            outerRadius={150}
            valueKey="numberOfVotes"
            fill="#8884d8"
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={((entry.name === correctSolution) && showSolution) ? '#00FF00' : '#8884d8'}
              />
            ))}
          </Pie>
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
          <Bar dataKey="numberOfVotes" fill="#8884d8" />
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
