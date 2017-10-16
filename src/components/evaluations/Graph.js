import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'
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
  handleShowGraph: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  showGraph: PropTypes.bool,
  showSolution: PropTypes.bool,
  visualization: PropTypes.string,
}

// TODO
const defaultProps = {
  showGraph: false,
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
const Graph = ({
  intl, handleShowGraph, showGraph, showSolution, visualization,
}) => (
  <div className="graph">
    {// if it is false, a placeholder should be shown
    // a click on said placeholder should then trigger display of the real graph
    !showGraph && (
      <Button className="showGraphButton" onClick={handleShowGraph}>
        <FormattedMessage id="teacher.evaluation.graph.showGraph" defaultMessage="Show Graph" />
      </Button>
    )}
    {visualization === 'PIE_CHART' &&
      showGraph && (
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
    {visualization === 'BAR_CHART' &&
      showGraph && (
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

      .showGraphButton {
        align-self: center;
      }

      .graph {
        border: 1px solid;
        height: 50rem;
        width: 50rem;
      }
    `}</style>
  </div>
)

Graph.propTypes = propTypes
Graph.defaultProps = defaultProps

export default Graph
