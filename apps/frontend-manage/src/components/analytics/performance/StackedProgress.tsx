import { ActivityProgress } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { twMerge } from 'tailwind-merge'

function StackedProgress({
  progress,
  participants,
  colors,
  showScale = false,
}: {
  progress: ActivityProgress
  participants: number
  colors: {
    started: string
    completed: string
    repeated: string
  }
  showScale?: boolean
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
    <div
      className={twMerge('flex h-8 items-center gap-4', showScale && 'h-16')}
    >
      <div
        className={twMerge(
          'w-48 overflow-hidden text-ellipsis whitespace-nowrap',
          showScale && 'mb-8'
        )}
      >
        {progress.activityName}
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={showScale ? 65 : 35}>
          <BarChart data={data} layout="vertical">
            <XAxis
              type="number"
              domain={[0, 100]}
              hide={!showScale}
              tickCount={5}
            />
            <YAxis type="category" hide />
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
            <Bar dataKey="repeated" stackId="a" fill={colors.repeated} />
            <Bar dataKey="completed" stackId="a" fill={colors.completed} />
            <Bar dataKey="started" stackId="a" fill={colors.started} />
            <Bar dataKey="full" stackId="a" fill="#f0f0f0" />
            <ReferenceLine x={25} stroke="#666" strokeDasharray="3 3" />
            <ReferenceLine x={50} stroke="#666" strokeDasharray="3 3" />
            <ReferenceLine x={75} stroke="#666" strokeDasharray="3 3" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div
        className={twMerge('mr-2.5 text-sm text-gray-500', showScale && 'mb-8')}
      >
        (N = {progress.startedCount})
      </div>
    </div>
  )
}

export default StackedProgress
