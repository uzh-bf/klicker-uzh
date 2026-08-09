import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

function CircularPerformancePlot({
  title,
  rates,
  colors,
}: {
  title: string
  rates: { correctRate: number; partialRate: number; incorrectRate: number }
  colors: { correct: string; partial: string; incorrect: string }
}) {
  const t = useTranslations()
  const [_, setActiveIndex] = useState<number | undefined>()
  const data = [
    { name: t('manage.analytics.successRate'), value: rates.correctRate },
    { name: t('manage.analytics.partialErrorRate'), value: rates.partialRate },
    { name: t('manage.analytics.errorRate'), value: rates.incorrectRate },
  ]

  return (
    <div className="flex h-full w-full flex-col items-center">
      <H3 className={{ root: 'mt-4' }}>{title}</H3>
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: -10, right: 15, bottom: 0, left: 15 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="45%"
              outerRadius="60%"
              dataKey="value"
              label={({ value }) => `${(value! * 100).toFixed(1)}%`}
              labelLine={true}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {data.map((entry) => {
                const colorValues = Object.values(colors)
                return (
                  <Cell
                    key={entry.name}
                    fill={colorValues[data.indexOf(entry)]}
                  />
                )
              })}
            </Pie>
            {/* {activeIndex !== undefined && (
              <text
                x="50%"
                y="48%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={Object.values(colors)[activeIndex]}
              >
                {data[activeIndex].name}
              </text>
            )} */}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default CircularPerformancePlot
