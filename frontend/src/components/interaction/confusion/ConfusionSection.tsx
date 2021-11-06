import React from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts'

interface Props {
  runningValue: any[]
  title: string
  xlabel: string[]
}

function ConfusionSection({ runningValue, title, xlabel }: Props): React.ReactElement {
  const histData = runningValue.map((val, index) => {
    return { value: val, title: xlabel[index] }
  })

  console.log(histData)

  return (
    <div className="flex-1">
      <h3>{title}</h3>
      <div>
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={histData}>
            <XAxis dataKey="title" />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ConfusionSection
