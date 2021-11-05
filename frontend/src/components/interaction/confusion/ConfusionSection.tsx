import { iterate } from 'localforage'
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
  runningValue: any[]
  title: string
  xlabel: string[]
}

function ConfusionSection({ runningValue, title, xlabel }: Props): React.ReactElement {
  return (
    <div className="confusionSection">
      <h3>{title}</h3>

      <div className="chart">
        {((): React.ReactElement => {
          if (runningValue?.reduce((a, b) => a + b, 0) === 0 || !runningValue) {
            return <FormattedMessage defaultMessage="No data yet." id="runningSession.confusionSection.noData" />
          }
          const histData = runningValue.map((val, index) => {
            return { value: val, title: xlabel[index] }
          })

          return (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart width={150} height={40} data={histData}>
                  <XAxis dataKey="title" />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
              <div>Running Average: {runningValue.map((val: any) => val + ',')}</div>
              <div>Number of Datapoints: {runningValue?.reduce((a, b) => a + b, 0)}</div>
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
