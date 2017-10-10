import React from 'react'
import { intlShape } from 'react-intl'
import { Pie, PieChart } from 'recharts'

// TODO
const propTypes = {
  graphType: intlShape.string,
  intl: intlShape.isRequired,
}

// TODO
const defaultProps = {
  graphType: 'pie',
}

const data01 = [{ name: 'Group A', value: 400 }, { name: 'Group B', value: 300 },
  { name: 'Group C', value: 300 }, { name: 'Group D', value: 200 }]

// TODO default value
const Graph = ({ intl, graphType }) => (
  <div className="visualization">
    <PieChart className="chart" width={500} height={450}>
      <Pie label data={data01} cx="50%" cy="50%" innerRadius={60} outerRadius={150} fill="#8884d8" />
    </PieChart>

    <style jsx>{`
      .title {
        font-weight: bold;
        margin-bottom: 0.5rem;
      }
    `}</style>
  </div>
)

Graph.propTypes = propTypes
Graph.defaultProps = defaultProps

export default Graph
