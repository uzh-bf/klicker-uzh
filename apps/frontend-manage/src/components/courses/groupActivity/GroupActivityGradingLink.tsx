import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface GroupActivityGradingLinkProps {
  activityId: string
  activityName: string
}

function GroupActivityGradingLink({
  activityId,
  activityName,
}: GroupActivityGradingLinkProps) {
  const t = useTranslations()

  return (
    <Link
      href={`/courses/grading/groupActivity/${activityId}`}
      data-cy={`grade-groupActivity-${activityName}`}
    >
      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
        <FontAwesomeIcon icon={faUpRightFromSquare} className="w-[1.1rem]" />
        <div>{t('manage.course.gradeGroupActivity')}</div>
      </div>
    </Link>
  )
}

export default GroupActivityGradingLink
