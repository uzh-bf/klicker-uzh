import { useQuery } from '@apollo/client'
import {
  GetCourseActivitiesDocument,
  ParticipantActivityPerformances,
} from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import TableSortingButton from '@klicker-uzh/shared-components/src/TableSortingButton'
import { Checkbox, H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

function StudentActivityPerformance({
  courseId,
  performances,
}: {
  courseId: string
  performances: ParticipantActivityPerformances[]
}) {
  const t = useTranslations()
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])

  const { loading, data } = useQuery(GetCourseActivitiesDocument, {
    variables: { courseId },
    skip: !courseId,
  })
  const course = data?.getCourseActivities

  const handleActivityToggle = (activityId: string) => {
    setSelectedActivities((prev) => {
      if (prev.includes(activityId)) {
        return prev.filter((id) => id !== activityId)
      }
      return [...prev, activityId]
    })
  }

  // TODO: extract the following functions to custom hooks
  const activityNameMap = useMemo(
    () => ({
      ...(course?.practiceQuizzes?.reduce<Record<string, string>>((acc, pq) => {
        acc[pq.id] = pq.name
        return acc
      }, {}) ?? {}),
      ...(course?.microLearnings?.reduce<Record<string, string>>((acc, ml) => {
        acc[ml.id] = ml.name
        return acc
      }, {}) ?? {}),
    }),
    [course?.practiceQuizzes, course?.microLearnings]
  )

  const tableData = useMemo(() => {
    if (loading || !course) {
      return []
    }

    // map the performances to a data structure where every selected activity entry can be
    // identified through a direct key - {activityId}-totalScore and {activityId}-completion
    return performances.map((studentPerformance) =>
      studentPerformance.performances.reduce<Record<string, string | number>>(
        (acc, performance) => {
          if (selectedActivities.includes(performance.activityId)) {
            acc[`${performance.activityId}-totalScore`] = performance.totalScore
            acc[`${performance.activityId}-completion`] = Math.round(
              performance.completion * 100
            )
          }

          return acc
        },
        {
          participantUsername: studentPerformance.participantUsername,
          participantEmail:
            studentPerformance.participantEmail ??
            t('manage.analytics.emailMissing'),
        }
      )
    )
  }, [loading, course, performances, t, selectedActivities])

  if (loading || !tableData) {
    return <Loader />
  }

  // TODO: add user notification if no activity is selected and add option to select all activities at once (hide table?!)
  // TODO: add explanation what we can see in the plot (total score and completion percentage)
  // TODO: fix issue where column names in csv export correspond to access keys and, if possible, also include completion percentage therein
  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2 className={{ root: 'mb-3' }}>
        {t('manage.analytics.studentActivityPerformance')}
      </H2>
      <div className="mb-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {course?.practiceQuizzes?.map((quiz) => (
            <div key={quiz.id} className="flex items-center space-x-2">
              <Checkbox
                id={`checkbox-${quiz.id}`}
                checked={selectedActivities.includes(quiz.id)}
                onCheck={() => handleActivityToggle(quiz.id)}
              />
              <label htmlFor={quiz.id} className="text-sm">
                {quiz.name}
              </label>
            </div>
          ))}
          {course?.microLearnings?.map((ml) => (
            <div key={ml.id} className="flex items-center space-x-2">
              <Checkbox
                id={`checkbox-${ml.id}`}
                checked={selectedActivities.includes(ml.id)}
                onCheck={() => handleActivityToggle(ml.id)}
              />
              <label htmlFor={ml.id} className="text-sm">
                {ml.name}
              </label>
            </div>
          ))}
        </div>
      </div>
      {performances.length > 0 ? (
        <DataTable
          isPaginated
          isResetSortingEnabled
          columns={[
            {
              accessorKey: 'participantUsername',
              header: t('manage.analytics.studentUsername'),
            },
            {
              accessorKey: 'participantEmail',
              header: t('manage.analytics.studentEmail'),
            },
            ...selectedActivities.map((activityId) => {
              const activityName = activityNameMap[activityId]

              return {
                accessorKey: `${activityId}-totalScore`,
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton column={column} title={activityName} />
                  )
                },
                cell: ({ row }: any) => {
                  const rowData = row.original
                  return `${rowData[`${activityId}-totalScore`]} ${t('shared.generic.points')} (${rowData[`${activityId}-completion`]} %)`
                },
                className: 'min-w-40',
              }
            }),
          ]}
          data={tableData ?? []}
          csvFilename={`${course?.name.replace(' ', '-')}_participant_activity`}
          className={{
            table: 'overflow-x-auto',
            tableHeader: 'h-7 p-2',
            tableCell: 'h-7 p-2',
          }}
        />
      ) : (
        <UserNotification
          type="info"
          message={t('manage.analytics.noStudentActivityPerformanceData')}
        />
      )}
    </div>
  )
}

export default StudentActivityPerformance
