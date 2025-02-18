import { useMutation } from '@apollo/client'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseLeaderboardDocument,
  LeaderboardEntry,
  UpdateWeeklyTimelineEntriesCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  H4,
  SelectField,
  Tabs,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import useCourseWeeklyDates from '~/lib/hooks/useCourseWeeklyDates'
import SuspendedCourseLeaderboard from './SuspendedCourseLeaderboard'

dayjs.extend(customParseFormat)

export type InvididualLeaderboardEntry = Omit<
  LeaderboardEntry,
  'level' | 'participantId' | 'participation'
>

interface IndividualLeaderboardProps {
  courseId: string
  courseName: string
  courseStart: string
  courseEnd: string
  numOfParticipants?: number | null
}

function IndividualLeaderboard({
  courseId,
  courseName,
  courseStart,
  courseEnd,
  numOfParticipants,
}: IndividualLeaderboardProps) {
  const t = useTranslations()

  const [leaderboardType, setLeaderboardType] = useState<
    'course' | 'weekly' | 'custom'
  >('course')
  const [weeklyStartDate, setWeeklyStartDate] = useState<string | undefined>(
    undefined
  )
  const [customStartDate, setCustomStartDate] = useState<string | undefined>(
    undefined
  )
  const [customEndDate, setCustomEndDate] = useState<string | undefined>(
    undefined
  )

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

  // compute all week beginnings between the start and end date
  const weeklyDates = useCourseWeeklyDates({ courseStart, courseEnd })

  return (
    <Tabs.TabContent value="ind-leaderboard" className={{ root: 'h-full p-2' }}>
      <div className="mb-3 flex flex-col">
        <H4>{t('manage.course.leaderboardData')}</H4>
        <div className="mb-1 flex flex-row flex-wrap items-center gap-x-3">
          <div className="min-w-max">{t('manage.course.quickSelection')}:</div>
          <Button
            basic
            onClick={() => {
              setLeaderboardType('course')
              setWeeklyStartDate(undefined)
              setCustomStartDate(undefined)
              setCustomEndDate(undefined)
            }}
            className={{ root: 'text-primary-100 h-8 hover:underline' }}
          >
            {t('manage.course.entireCourse')}
          </Button>
          <Button
            basic
            onClick={() => {
              setLeaderboardType('weekly')
              const lastWeek =
                weeklyDates[weeklyDates.length - 1] || weeklyDates[0]
              setWeeklyStartDate(lastWeek)
              setCustomStartDate(undefined)
              setCustomEndDate(undefined)
            }}
            className={{ root: 'text-primary-100 h-8 hover:underline' }}
          >
            {t('manage.course.lastWeek')}
          </Button>
          {weeklyDates.length >= 2 && (
            <Button
              basic
              onClick={() => {
                setLeaderboardType('custom')
                setWeeklyStartDate(undefined)
                if (weeklyDates.length >= 2) {
                  setCustomStartDate(weeklyDates[weeklyDates.length - 2])
                  setCustomEndDate(weeklyDates[weeklyDates.length - 1])
                } else {
                  setCustomStartDate(weeklyDates[0])
                  setCustomEndDate(weeklyDates[0])
                }
              }}
              className={{ root: 'text-primary-100 h-8 hover:underline' }}
            >
              {t('manage.course.lastTwoWeeks')}
            </Button>
          )}
        </div>
        <div className="flex flex-row items-end gap-3">
          <SelectField
            label={t('manage.course.leaderboardType')}
            labelType="small"
            value={leaderboardType}
            tooltip={t('manage.course.leaderboardTypeTooltip')}
            onChange={(newValue) => {
              setLeaderboardType(newValue as 'course' | 'weekly' | 'custom')

              if (newValue === 'course' || newValue === 'custom') {
                setWeeklyStartDate(undefined)
                setCustomStartDate(undefined)
                setCustomEndDate(undefined)
              } else if (newValue === 'weekly') {
                setWeeklyStartDate(weeklyDates[0])
                setCustomStartDate(undefined)
                setCustomEndDate(undefined)
              }
            }}
            items={[
              { value: 'course', label: t('manage.course.entireCourse') },
              { value: 'weekly', label: t('manage.course.weekly') },
              { value: 'custom', label: t('manage.course.custom') },
            ]}
            className={{ select: { trigger: 'h-8 w-48' } }}
          />
          {leaderboardType === 'weekly' && (
            <SelectField
              required
              label={t('manage.course.timeRange')}
              labelType="small"
              value={weeklyStartDate}
              onChange={(newValue) => {
                setWeeklyStartDate(newValue)
              }}
              items={weeklyDates.map((date) => ({
                value: date,
                label: `${date} - ${dayjs(date, 'DD.MM.YYYY').add(6, 'day').format('DD.MM.YYYY')}`,
              }))}
              className={{ select: { trigger: 'h-8 w-56' } }}
            />
          )}
          {leaderboardType === 'custom' && (
            <>
              <SelectField
                required
                label={t('shared.generic.startDate')}
                labelType="small"
                value={customStartDate}
                onChange={(newValue) => {
                  setCustomStartDate(newValue)
                }}
                items={weeklyDates.map((date) => ({
                  value: date,
                  label: date,
                }))}
                className={{ select: { trigger: 'h-8 w-32' } }}
              />
              <SelectField
                required
                label={t('shared.generic.endDate')}
                labelType="small"
                value={customEndDate}
                onChange={(newValue) => {
                  setCustomEndDate(newValue)
                }}
                items={weeklyDates
                  .filter((_, index) => {
                    const startIndex = customStartDate
                      ? weeklyDates.findIndex(
                          (date) => date === customStartDate
                        )
                      : 0
                    return index >= startIndex
                  })
                  .map((date) => ({
                    value: date,
                    label: dayjs(date, 'DD.MM.YYYY')
                      .add(6, 'day')
                      .format('DD.MM.YYYY'),
                  }))}
                className={{ select: { trigger: 'h-8 w-32' } }}
              />
            </>
          )}
          {leaderboardType !== 'course' && (
            <Button
              onClick={() => updateWeeklyTimelineEntriesCourse()}
              className={{ root: 'h-8 shadow-none' }}
              disabled={updateLoading}
            >
              <FontAwesomeIcon
                icon={faSync}
                className={updateLoading ? 'animate-spin' : ''}
              />
              {t('shared.generic.update')}
            </Button>
          )}
        </div>
      </div>
      <UserNotification
        message={t('manage.course.emailsInLeaderboardExport')}
        className={{ root: 'mb-3' }}
      />
      <Suspense fallback={<Loader />}>
        <SuspendedCourseLeaderboard
          courseId={courseId}
          courseName={courseName}
          numOfParticipants={numOfParticipants ?? 0}
          leaderboardType={leaderboardType}
          weeklyStartDate={weeklyStartDate}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
        />
      </Suspense>
    </Tabs.TabContent>
  )
}

export default IndividualLeaderboard
