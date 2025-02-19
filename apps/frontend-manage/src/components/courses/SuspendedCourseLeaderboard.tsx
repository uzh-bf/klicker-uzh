import { useMutation, useSuspenseQuery } from '@apollo/client'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseLeaderboardDocument,
  UpdateWeeklyTimelineEntriesCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import { Button } from '@uzh-bf/design-system'
import { TableCell } from '@uzh-bf/design-system/dist/future'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

dayjs.extend(customParseFormat)

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
  const { data, refetch } = useSuspenseQuery(GetCourseLeaderboardDocument, {
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

  const [updateWeeklyTimelineEntriesCourse, { loading: updateLoading }] =
    useMutation(UpdateWeeklyTimelineEntriesCourseDocument, {
      variables: { courseId },
      refetchQueries: [
        {
          query: GetCourseLeaderboardDocument,
          variables: {
            courseId,
            courseSelection: leaderboardType === 'course',
            weeklySelection: leaderboardType === 'weekly',
            customSelection: leaderboardType === 'custom',
            startDate:
              leaderboardType === 'weekly' ? weeklyStartDate : customStartDate,
            endDate: customEndDate,
          },
        },
      ],
    })

  const showLastUpdated =
    data.getCourseLeaderboard?.computedAt &&
    ((leaderboardType === 'weekly' &&
      weeklyStartDate &&
      dayjs().isBefore(dayjs(weeklyStartDate, 'DD.MM.YYYY').add(7, 'day'))) ||
      (leaderboardType === 'custom' &&
        customEndDate &&
        (dayjs().isSame(dayjs(customEndDate, 'DD.MM.YYYY'), 'day') ||
          dayjs().isBefore(dayjs(customEndDate, 'DD.MM.YYYY').add(7, 'day')))))

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
        <TableCell colSpan={3} className="px-2 py-2 text-slate-700">
          <div
            className={twMerge(
              'flex flex-row justify-end text-right',
              showLastUpdated ? 'justify-between' : ''
            )}
          >
            {showLastUpdated && (
              <div className="flex flex-col gap-0.5 text-left">
                <div>
                  {`${t('manage.course.lastModified')}: ${dayjs(data.getCourseLeaderboard?.computedAt).format('DD.MM.YYYY, HH:mm')}`}
                </div>
                <Button
                  onClick={async () => {
                    await updateWeeklyTimelineEntriesCourse()
                    await refetch()
                  }}
                  className={{ root: 'h-6 w-max shadow-none' }}
                  disabled={updateLoading}
                >
                  <FontAwesomeIcon
                    icon={faSync}
                    className={updateLoading ? 'animate-spin' : ''}
                  />
                  {t('shared.generic.recompute')}
                </Button>
              </div>
            )}

            <div>
              <div>
                {t('manage.course.participantsLeaderboard', {
                  number: data.getCourseLeaderboard?.numOfActiveParticipants,
                })}
                /{numOfParticipants}
              </div>
              <div>
                {t('manage.course.avgPoints', {
                  points:
                    data.getCourseLeaderboard?.averageActiveScore?.toFixed(2),
                })}
              </div>
            </div>
          </div>
        </TableCell>
      }
    />
  )
}

export default SuspendedCourseLeaderboard
