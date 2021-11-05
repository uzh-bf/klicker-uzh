import React from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Props {
  runningValue: any[]
  title: string
  xlabel: string[]
}

function ConfusionSection({ runningValue, title, xlabel }: Props): React.ReactElement {
  return (
    <div className="confusionSection min-w-[300px]">
      <h3>{title}</h3>

      <div className="chart">
        {((): React.ReactElement => {
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
