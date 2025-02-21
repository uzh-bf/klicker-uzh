import { CourseStudentTimeline } from '@klicker-uzh/graphql/dist/ops'
import TimelineCourseChart from './TimelineCourseChart'
import TimelineCourseInformation from './TimelineCourseInformation'

function TimelineCourse({ course }: { course: CourseStudentTimeline }) {
  const totalPoints =
    course.courseGamified &&
    course.timelineEntries &&
    course.timelineEntries.length > 0
      ? course.timelineEntries[course.timelineEntries.length - 1].totalPoints
      : 0
  const totalXp =
    course.timelineEntries && course.timelineEntries.length > 0
      ? course.timelineEntries[course.timelineEntries.length - 1].totalXp
      : 0

  return (
    <div className="flex w-full flex-col gap-2 md:flex-row md:gap-3">
      <TimelineCourseInformation
        courseName={course.courseName}
        courseGamified={course.courseGamified}
        courseStart={course.courseStart}
        courseEnd={course.courseEnd}
        totalPoints={totalPoints}
        totalXp={totalXp}
      />
      <TimelineCourseChart course={course} />
    </div>
  )
}

export default TimelineCourse
