import React from 'react'
import GaugeChart from 'react-gauge-chart'

interface Props {
  runningValue: number
  title: string
  xlabel: string
}

function ConfusionSection({ runningValue, title, xlabel }: Props): React.ReactElement {
  if (isNaN(runningValue)) {
    runningValue = 0.01
  }

  return (
    <div>
      <h3 className="inline-block mr-3">{title}</h3>
      <p className="inline-block">{'(' + xlabel + ')'}</p>
      <div className="w-full h-38">
        <GaugeChart id="gauge-chart" nrOfLevels={20} percent={runningValue} hideText={true} animate={false} />
      </div>
    </div>
  )
}

export default ConfusionSection
