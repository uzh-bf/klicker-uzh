import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faCheck, faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Course } from '@klicker-uzh/graphql/dist/ops'
import { H4 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'

function AnalyticsCourseLabel({
  course,
}: {
  course: Pick<Course, 'id' | 'name' | 'startDate' | 'endDate'>
}) {
  const isPast = course.endDate
    ? dayjs(course.endDate).isBefore(dayjs())
    : false
  const isFuture = course.startDate
    ? dayjs(course.startDate).isAfter(dayjs())
    : false

  return (
    <div className="flex flex-row items-center gap-3">
      {isPast ? (
        <FontAwesomeIcon icon={faCheck} className="text-green-600" />
      ) : isFuture ? (
        <FontAwesomeIcon icon={faClock} className="text-orange-400" />
      ) : (
        <FontAwesomeIcon icon={faPlay} className="text-uzh-blue-100" />
      )}
      <H4 className={{ root: 'mb-0 flex h-10 items-center' }}>{course.name}</H4>
    </div>
  )
}

export default AnalyticsCourseLabel
