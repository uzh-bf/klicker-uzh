import React from 'react'
/*import {
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Label,
} from 'recharts'*/
import { FormattedMessage } from 'react-intl'

interface Props {
  data: any[]
  title: string
  ylabel: string
}

function ConfusionSection({ data, title, ylabel }: Props): React.ReactElement {
  return (
    <div className="confusionSection">
      <h3>{title}</h3>

      <div className="chart">
        {((): React.ReactElement => {
          // if there is no data for the section, display a message
          if (data.length === 0) {
            return <FormattedMessage defaultMessage="No data yet." id="runningSession.confusionSection.noData" />
          }

          // otherwise render a chart
          return (
            <>
              <div>Running Average: {data[data.length - 1].valueRunning.map((element: any) => element + ', ')}</div>
              <div>Number of Datapoints: {data.length}</div>
            </>
          )
        })()}
      </div>

      <style jsx>{`
        .confusionSection {
          display: flex;
          flex-direction: column;

          height: 15rem;

          .chart {
            flex: 1;

            height: 10rem;
          }
        }
      `}</style>
    </div>
  )
}

export default ConfusionSection
