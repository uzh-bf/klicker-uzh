import { useQuery } from '@apollo/client'
import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import {
  GetCourseActivitiesDocument,
  ParticipantActivityPerformances,
} from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import TableSortingButton from '@klicker-uzh/shared-components/src/TableSortingButton'
import {
  Button,
  Checkbox,
  H2,
  H4,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import useActivityMap from './useActivityMap'
import useStudentActivityPerformanceTableData from './useStudentActivityPerformanceTableData'

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
    fetchPolicy: 'network-only',
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

  const { activityNameMap, allActivityIds } = useActivityMap({
    practiceQuizzes: course?.practiceQuizzes,
    microLearnings: course?.microLearnings,
  })

  const tableData = useStudentActivityPerformanceTableData({
    dataAvailable: !loading && !!course,
    performances,
    selectedActivities,
  })

  if (loading || !tableData) {
    return <Loader />
  }

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <div className="mb-3 flex flex-row items-center gap-10">
        <H2 className={{ root: 'mb-0' }}>
          {t('manage.analytics.studentActivityPerformance')}
        </H2>
        <Button
          onClick={() => {
            setSelectedActivities((prev) =>
              prev.length === allActivityIds.length ? [] : allActivityIds
            )
          }}
          className={{
            root: 'h-7 py-0',
          }}
        >
          {selectedActivities.length === allActivityIds.length ? (
            <>
              <Button.Icon icon={faX} />
              <Button.Label>
                {t('manage.analytics.deselectAllActivities')}
              </Button.Label>
            </>
          ) : (
            <>
              <Button.Icon icon={faCheck} />
              <Button.Label>
                {t('manage.analytics.selectAllActivities')}
              </Button.Label>
            </>
          )}
        </Button>
      </div>
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-col gap-4">
          <div>
            <H4>{t('shared.generic.practiceQuizzes')}</H4>
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
            </div>
          </div>
          <div>
            <H4>{t('shared.generic.microlearnings')}</H4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
        </div>
      </div>
      {performances.length > 0 && selectedActivities.length > 0 ? (
        <>
          <UserNotification className={{ root: 'mb-2 mt-6' }}>
            {t('manage.analytics.participantActivityPerformanceDescription')}
          </UserNotification>
          <DataTable
            isPaginated
            isResetSortingEnabled
            columns={[
              {
                accessorKey: 'participantUsername',
                header: t('manage.analytics.studentUsername'),
                displayName: t('manage.analytics.studentUsername'),
              },
              {
                accessorKey: 'participantEmail',
                header: t('manage.analytics.studentEmail'),
                displayName: t('manage.analytics.studentEmail'),
              },
              ...selectedActivities.flatMap((activityId) => {
                const activityName = activityNameMap[activityId]

                return [
                  {
                    accessorKey: `${activityId}-totalScore`,
                    header: ({ column }: any) => {
                      return (
                        <TableSortingButton
                          column={column}
                          title={activityName}
                        />
                      )
                    },
                    displayName: `${t('manage.analytics.totalScore')}: ${activityName} [${t('shared.generic.points')}]`,
                    cell: ({ row }: any) => {
                      const rowData = row.original
                      return `${rowData[`${activityId}-totalScore`]} ${t('shared.generic.points')} (${rowData[`${activityId}-completion`]} %)`
                    },
                    className: 'min-w-40',
                  },
                  {
                    accessorKey: `${activityId}-completion`,
                    csvOnly: true,
                    displayName: `${t('manage.analytics.activityProgress')}: ${activityName} [%]`,
                  },
                ]
              }),
              {
                accessorKey: 'completedActivities',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t(
                        'manage.analytics.completedActivitiesExplanation'
                      )}
                    />
                  )
                },
                displayName: t('manage.analytics.completedActivities'),
              },
            ]}
            data={tableData ?? []}
            csvFilename={`${course?.name.replace(' ', '-')}_participant_activity_performance`}
            className={{
              table: 'overflow-x-auto',
              tableHeader: 'h-7 p-2',
              tableCell: 'h-7 p-2',
            }}
          />
        </>
      ) : selectedActivities.length === 0 ? (
        <UserNotification
          type="info"
          message={t('manage.analytics.noActivitySelected')}
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
