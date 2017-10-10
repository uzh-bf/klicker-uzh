import React from 'react'
import { intlShape } from 'react-intl'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, Pie, PieChart, XAxis, YAxis } from 'recharts'

// TODO
const propTypes = {
  graphType: intlShape.string,
  intl: intlShape.isRequired,
}

// TODO
const defaultProps = {
  graphType: 'pie',
}

const data = [{ name: 'Group A', value: 400 }, { name: 'Group B', value: 300 },
  { name: 'Group C', value: 300 }, { name: 'Group D', value: 200 }]

// TODO default value
const Graph = ({ intl, graphType }) => (
  <div className="visualization">
    {
      graphType === 'pie' &&
      <PieChart className="chart" width={500} height={450}>
        <Pie label data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={150} fill="#8884d8" />
      </PieChart>
    }
    {
      graphType === 'bar' &&
      <BarChart width={500} height={450} data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <CartesianGrid strokeDasharray="3 3" />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#8884d8" />
      </BarChart>
    }


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
