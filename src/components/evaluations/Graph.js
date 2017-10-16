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
  visualization: 'PIE_CHART',
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
    {visualization === 'PIE_CHART' && (
      <ResponsiveContainer>
        <PieChart>
          <Pie
            label
            data={data}
            innerRadius={120}
            outerRadius={300}
            valueKey="numberOfVotes"
            fill="#8884d8"
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.name === correctSolution && showSolution ? '#00FF00' : '#8884d8'}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )}
    {visualization === 'BAR_CHART' && (
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip />
          <Legend />
          <Bar dataKey="numberOfVotes">
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.name === correctSolution && showSolution ? '#00FF00' : '#8884d8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )}
    {visualization !== 'BAR_CHART' &&
      visualization !== 'PIE_CHART' && <div>This type of graph is not implemented yet!</div>}

    <style jsx>{`
      .title {
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .graph {
        height: 50rem;
        width: 100rem;
      }
    `}</style>
  </div>
)

Graph.propTypes = propTypes
Graph.defaultProps = defaultProps

export default Graph
