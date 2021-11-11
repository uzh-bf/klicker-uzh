import React from 'react'
import ReactSpeedometer from 'react-d3-speedometer'

interface Props {
  runningValue: number
  title: string
  labels: any
}

function ConfusionSection({ runningValue, title, labels }: Props): React.ReactElement {
  return (
    <div>
      <h3 className="inline-block mr-3">{title}</h3>
      <div className="w-full h-38">
        <ReactSpeedometer
          width={300}
          height={200}
          //fluidWidth={true}
          minValue={0}
          maxValue={1}
          value={runningValue}
          startColor="#FF0000"
          endColor="#00FF00"
          needleColor="steelblue"
          customSegmentStops={[0, 0.15, 0.3, 0.7, 0.85, 1]}
          segmentColors={['#e72e06', '#ffff31', '#42ff42', '#ffff31', '#e72e06']}
          paddingHorizontal={5}
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
          currentValueText=" "
          // needlecolor='#000000'
        />
      </div>
    </div>
  )
}

export default ConfusionSection
