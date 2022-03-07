import clsx from 'clsx'
import React from 'react'
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'

export default function BarChart({ className, legend, likert, title, data }) {
  const total = data.reduce((acc, item) => item.count + acc, 0)

  return (
    <div className={clsx('max-w-lg border border-solid p-2', className)}>
      {title && (
        <div className="w-full px-2 py-1 mb-4 font-bold bg-gray-100 rounded shadow">
          {title}
        </div>
      )}

      <ResponsiveContainer height={200}>
        <RechartsBarChart
          data={data}
          margin={{
            top: 10,
            right: 20,
            left: -10,
            bottom: 10,
          }}
        >
          <XAxis
            dataKey="name"
            ticks={
              likert ? [data[0].name, data[2].name, data[4].name] : undefined
            }
            tickMargin={10}
          />
          <YAxis
            domain={[0, 'dataMax + 1']}
            interval={1}
            allowDecimals={false}
            minTickGap={1}
          />
          <Tooltip />
          {legend && <Legend />}
          <Bar dataKey="count" fill="#dc6027" fillOpacity={0.5} barSize={50} />
        </RechartsBarChart>
      </ResponsiveContainer>

      <div className="text-sm italic text-gray-500">
        Own depicition based on preliminary data from {total} respondents.
      </div>
    </div>
  )
}
