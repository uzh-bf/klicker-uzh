import { Course } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import ActivityDashboardLabel from './ActivityDashboardLabel'
import PerformanceDashboardLabel from './PerformanceDashboardLabel'
import QuizDashboardLabel from './QuizDashboardLabel'

function DashboardButtons({ course }: { course: Pick<Course, 'id' | 'name'> }) {
  const router = useRouter()

  return (
    <div
      key={`dashboards-${course.id}`}
      className="flex h-10 flex-row items-center gap-2"
    >
      {[
        {
          href: `/analytics/${course.id}/activity`,
          label: <ActivityDashboardLabel />,
          cy: `activity-dashboard-button-${course.name}`,
        },
        {
          href: `/analytics/${course.id}/performance`,
          label: <PerformanceDashboardLabel />,
          cy: `performance-dashboard-button-${course.name}`,
        },
        {
          href: `/analytics/${course.id}/quizzes`,
          label: <QuizDashboardLabel />,
          cy: `quiz-dashboard-button-${course.name}`,
        },
      ].map((button) => (
        <Button
          className={{
            root: 'h-8 py-0',
          }}
          onClick={() => router.push(button.href)}
          data={{ cy: button.cy }}
          key={`dashboard-button-${button.href}`}
        >
          {button.label}
        </Button>
      ))}
    </div>
  )
}

export default DashboardButtons
