import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button } from 'semantic-ui-react'
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
  result: PropTypes.shape({
    options: PropTypes.arrayOf({
      correct: PropTypes.bool,
      name: PropTypes.string,
      numberOfVotes: PropTypes.number,
    }),
    totalResponses: PropTypes.number,
  }),
  showGraph: PropTypes.bool,
  showSolution: PropTypes.bool,
  visualization: PropTypes.string,
}

// TODO
const defaultProps = {
  result: null,
  showGraph: false,
  showSolution: true,
  visualization: 'PIE_CHART',
}

// TODO default value
const Graph = ({
  intl, handleShowGraph, result, showGraph, showSolution, visualization,
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
              data={result.options}
              innerRadius={120}
              outerRadius={300}
              valueKey="numberOfVotes"
              fill="#8884d8"
            >
              {result.options.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.correct && showSolution ? '#00FF00' : '#8884d8'}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
    {visualization === 'BAR_CHART' &&
      showGraph && (
        <ResponsiveContainer>
          <BarChart data={result.options}>
            <XAxis dataKey="name" />
            <YAxis />
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip />
            <Legend />
            <Bar dataKey="numberOfVotes">
              {result.options.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.name && showSolution ? '#00FF00' : '#8884d8'}
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
