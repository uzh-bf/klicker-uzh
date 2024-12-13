import { ActivityProgress } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function StackedProgress({
  progress,
  participants,
  colors,
}: {
  progress: ActivityProgress
  participants: number
  colors: {
    started: string
    completed: string
    repeated: string
  }
}) {
  const t = useTranslations()
  const repeatedSet =
    progress.repeatedCount !== null &&
    typeof progress.repeatedCount !== 'undefined'
  const repeatedPercent = repeatedSet
    ? (progress.repeatedCount! / participants) * 100
    : 0
  const completedPercent = (progress.completedCount / participants) * 100
  const startedPercent = (progress.startedCount / participants) * 100

  const data = [
    {
      repeated: repeatedPercent,
      completed: completedPercent - repeatedPercent,
      started: startedPercent - completedPercent,
      full: 100 - startedPercent,
    },
  ]

  return (
    <div className="flex h-8 items-center gap-4">
      <div className="w-48 overflow-hidden overflow-ellipsis whitespace-nowrap">
        {progress.activityName}
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={35}>
          <BarChart data={data} layout="vertical">
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" hide />
            <Bar dataKey="repeated" stackId="a" fill={colors.repeated} />
            <Bar dataKey="completed" stackId="a" fill={colors.completed} />
            <Bar dataKey="started" stackId="a" fill={colors.started} />
            <Bar dataKey="full" stackId="a" fill="#f0f0f0" />
            <Tooltip
              wrapperStyle={{ zIndex: 20 }}
              content={({ payload }) => {
                if (!payload?.length) return null

                return (
                  <div className="flex flex-col rounded border bg-white p-2 shadow-md">
                    <div
                      style={{ color: colors.started }}
                    >{`${t('manage.analytics.started')}: ${startedPercent.toFixed(1)} %`}</div>
                    <div
                      style={{ color: colors.completed }}
                    >{`${t('manage.analytics.completed')}: ${completedPercent.toFixed(1)} %`}</div>
                    {repeatedSet ? (
                      <div
                        style={{ color: colors.repeated }}
                      >{`${t('manage.analytics.repeated')}: ${repeatedPercent.toFixed(1)} %`}</div>
                    ) : null}
                  </div>
                )
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default StackedProgress
