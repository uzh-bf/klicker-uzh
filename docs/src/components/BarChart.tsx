import React from 'react'
import {
  Bar,
  Legend,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { twMerge } from 'tailwind-merge'

export default function BarChart({ className, legend, likert, title, data }) {
  const total = data.reduce((acc, item) => item.count + acc, 0)

  return (
    <div
      className={twMerge(
        'max-w-lg rounded border border-solid border-gray-300 p-2',
        className
      )}
    >
      {title && (
        <div className="mb-4 w-full rounded bg-gray-100 px-2 py-1 font-bold shadow">
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
