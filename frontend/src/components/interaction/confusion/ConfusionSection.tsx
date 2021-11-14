import React from 'react'
import ReactSpeedometer from 'react-d3-speedometer'

interface Props {
  runningValue: number
  title: string
  labels: any
}

const RED_COLOR = 'rgba(240, 43, 30, 0.7)'
const ORANGE_COLOR = 'rgba(245, 114, 0, 0.7)'
const GREEN_COLOR = 'rgba(22, 171, 57, 0.7)'

function ConfusionSection({ runningValue, title, labels }: Props): React.ReactElement {
  return (
    <div className="w-full">
      <h3>{title}</h3>
      <div className="w-full min-h-[180px]">
        <ReactSpeedometer
          fluidWidth
          currentValueText=" "
          customSegmentLabels={[
            {
              text: labels.min,
              // @ts-ignore
              position: 'OUTSIDE',
              color: '#000000',
            },
            {
              text: '',
              color: '#000000',
            },
            {
              text: labels.mid,
              // @ts-ignore
              position: 'OUTSIDE',
              color: '#000000',
            },
            {
              text: '',
              color: '#000000',
            },
            {
              text: labels.max,
              // @ts-ignore
              position: 'OUTSIDE',
              color: '#000000',
            },
          ]}
          customSegmentStops={[0, 0.1, 0.25, 0.75, 0.9, 1]}
          height={200}
          maxValue={1}
          minValue={0}
          needleColor="#dc6027"
          needleHeightRatio={0.4}
          segmentColors={[RED_COLOR, ORANGE_COLOR, GREEN_COLOR, ORANGE_COLOR, RED_COLOR]}
          startColor="#FF0000"
          value={runningValue}
        />
      </div>
    </div>
  )
}

export default ConfusionSection
