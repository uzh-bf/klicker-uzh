import React, { PureComponent } from 'react'
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
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Props {
  data: any[]
  title: string
  xlabel: string[]
}

function ConfusionSection({ data, title, xlabel }: Props): React.ReactElement {
  return (
    <div className="confusionSection">
      <h3>{title}</h3>

      <div className="chart">
        {((): React.ReactElement => {
          // if there is no data for the section, display a message
          if (data.length === 0) {
            return <FormattedMessage defaultMessage="No data yet." id="runningSession.confusionSection.noData" />
          }

          let counter = 0
          // otherwise render a histogram
          const HistData = data[data.length - 1].valueRunning.map((elem: any) => {
            counter++
            return { value: elem, title: xlabel[counter - 1] }
          })
          console.log(HistData)

          return (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart width={150} height={40} data={HistData}>
                  <XAxis dataKey="title" />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
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
