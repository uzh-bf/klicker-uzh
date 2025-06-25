import { useMutation, useSuspenseQuery } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseLeaderboardDocument,
  UpdateWeeklyTimelineEntriesCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import { Button, ShadcnTableCell } from '@uzh-bf/design-system'
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
  leaderboardType: 'course' | 'weekly' | '7rolling' | '14rolling' | 'custom'
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
      rollingSelection:
        leaderboardType === '7rolling' || leaderboardType === '14rolling',
      customSelection: leaderboardType === 'custom',
      startDate:
        leaderboardType === 'weekly' ? weeklyStartDate : customStartDate,
      endDate: customEndDate,
      days: leaderboardType === '7rolling' ? 7 : 14,
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
    leaderboardType === '7rolling' ||
    leaderboardType === '14rolling' ||
    (leaderboardType === 'weekly' &&
      weeklyStartDate &&
      dayjs().isBefore(dayjs(weeklyStartDate, 'DD.MM.YYYY').add(7, 'day'))) ||
    (leaderboardType === 'custom' &&
      customEndDate &&
      (dayjs().isSame(dayjs(customEndDate, 'DD.MM.YYYY'), 'day') ||
        dayjs().isBefore(dayjs(customEndDate, 'DD.MM.YYYY').add(7, 'day'))))

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
        <ShadcnTableCell colSpan={3} className="px-2 py-2 text-slate-700">
          <div
            className={twMerge(
              'flex flex-row justify-end text-right',
              showLastUpdated ? 'justify-between' : ''
            )}
          >
            {showLastUpdated && (
              <div className="flex flex-col gap-0.5 text-left">
                {(leaderboardType === 'weekly' ||
                  leaderboardType === 'custom') && (
                  <div>
                    {`${t('manage.course.lastModified')}: ${data.getCourseLeaderboard?.computedAt ? dayjs(data.getCourseLeaderboard?.computedAt).format('DD.MM.YYYY, HH:mm') : t('shared.generic.never')}`}
                  </div>
                )}
                {(leaderboardType === '7rolling' ||
                  leaderboardType === '14rolling') && (
                  <div className="mb-0.5 flex flex-row items-center gap-1">
                    <FontAwesomeIcon icon={faClock} />
                    <span>
                      {data.getCourseLeaderboard?.computedAt
                        ? `${dayjs(data.getCourseLeaderboard.computedAt)
                            .subtract(
                              leaderboardType === '7rolling' ? 7 : 14,
                              'day'
                            )
                            .format(
                              'DD.MM.YYYY, HH:mm'
                            )} - ${dayjs(data.getCourseLeaderboard.computedAt).format('DD.MM.YYYY, HH:mm')}`
                        : t('shared.generic.never')}
                    </span>
                  </div>
                )}
                <Button
                  onClick={async () => {
                    if (
                      leaderboardType === 'weekly' ||
                      leaderboardType === 'custom'
                    ) {
                      await updateWeeklyTimelineEntriesCourse()
                    }

                    await refetch()
                  }}
                  className={{ root: 'h-6 w-max' }}
                  disabled={updateLoading}
                >
                  <Button.Icon
                    icon={faSync}
                    className={{
                      root: twMerge(
                        'h-3.5 w-3.5',
                        updateLoading ? 'animate-spin' : ''
                      ),
                    }}
                  />
                  <Button.Label>{t('shared.generic.recompute')}</Button.Label>
                </Button>
              </div>
            )}

            <div>
              <div>
                {t('manage.course.participantsLeaderboard', {
                  number:
                    data.getCourseLeaderboard?.numOfActiveParticipants ?? 0,
                })}
                /{numOfParticipants}
              </div>
              <div>
                {t('manage.course.avgPoints', {
                  points:
                    data.getCourseLeaderboard?.averageActiveScore?.toFixed(2) ??
                    0,
                })}
              </div>
            </div>
          </div>
        </ShadcnTableCell>
      }
    />
  )
}

export default SuspendedCourseLeaderboard
