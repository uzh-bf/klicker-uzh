import { useSuspenseQuery } from '@apollo/client'
import { GetCourseLeaderboardDocument } from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import { TableCell } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'

function SuspendedCourseLeaderboard({
  courseId,
  courseName,
  numOfParticipants,
  leaderboardType,
  weeklyStartDate,
  customStartDate,
  customEndDate,
}: {
  courseId: string
  courseName: string
  numOfParticipants: number
  leaderboardType: 'course' | 'weekly' | 'custom'
  weeklyStartDate?: string
  customStartDate?: string
  customEndDate?: string
}) {
  const t = useTranslations()
  const { data } = useSuspenseQuery(GetCourseLeaderboardDocument, {
    variables: {
      courseId,
      courseSelection: leaderboardType === 'course',
      weeklySelection: leaderboardType === 'weekly',
      customSelection: leaderboardType === 'custom',
      startDate:
        leaderboardType === 'weekly' ? weeklyStartDate : customStartDate,
      endDate: customEndDate,
    },
  })

  return (
    <DataTable
      isPaginated
      columns={[
        {
          accessorKey: 'rank',
          header: t('shared.leaderboard.rank'),
          displayName: t('shared.leaderboard.rank'),
        },
        {
          accessorKey: 'username',
          header: t('shared.leaderboard.username'),
          displayName: t('shared.leaderboard.username'),
        },
        {
          accessorKey: 'email',
          header: t('shared.leaderboard.email'),
          csvOnly: true,
          displayName: t('shared.leaderboard.email'),
        },
        {
          accessorKey: 'score',
          header: t('shared.leaderboard.points'),
          displayName: t('shared.leaderboard.points'),
        },
      ]}
      data={data.getCourseLeaderboard?.leaderboard ?? []}
      csvFilename={`${courseName.replace(' ', '-')}_course_leaderboard`}
      className={{
        tableHeader: 'h-7 p-2',
        tableCell: 'h-7 p-2',
      }}
      footerContent={
        <TableCell colSpan={3} className="px-1 py-2 text-right text-slate-700">
          <div>
            {t('manage.course.participantsLeaderboard', {
              number: data.getCourseLeaderboard?.numOfActiveParticipants,
            })}
            /{numOfParticipants}
          </div>
          <div>
            {t('manage.course.avgPoints', {
              points: data.getCourseLeaderboard?.averageActiveScore?.toFixed(2),
            })}
          </div>
        </TableCell>
      }
    />
  )
}

export default SuspendedCourseLeaderboard
