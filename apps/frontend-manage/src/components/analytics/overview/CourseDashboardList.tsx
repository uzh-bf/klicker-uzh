import { Course } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import AnalyticsCourseLabel from './AnalyticsCourseLabel'
import DashboardButtons from './DashboardButtons'

function CourseDashboardList({
  courses,
}: {
  courses?: Pick<Course, 'id' | 'name' | 'startDate' | 'endDate'>[] | null
}) {
  const t = useTranslations()

  return (
    <div className="flex w-full justify-center">
      <div className="flex flex-col">
        <H3>{t('manage.analytics.selectAnalyticsDashboard')}:</H3>
        <div className="flex flex-row gap-10">
          <div className="flex flex-col gap-2">
            {courses?.map((course) => (
              <AnalyticsCourseLabel
                key={`${course.id}-label`}
                course={course}
                data-cy={`analytics-course-label-${course.name}`}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {courses?.map((course) => (
              <DashboardButtons
                key={`${course.id}-dashboard-buttons`}
                course={course}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CourseDashboardList
