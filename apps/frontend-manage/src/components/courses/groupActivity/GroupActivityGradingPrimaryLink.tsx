import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import PrimaryActionLink from '../actions/PrimaryActionLink'

interface GroupActivityGradingPrimaryLinkProps {
  activityId: string
  activityName: string
}

function GroupActivityGradingPrimaryLink({
  activityId,
  activityName,
}: GroupActivityGradingPrimaryLinkProps) {
  const t = useTranslations()

  return (
    <PrimaryActionLink
      href={`/courses/grading/groupActivity/${activityId}`}
      label={t('manage.course.gradeGroupActivity')}
      icon={faUpRightFromSquare}
      data={{ cy: `grade-groupActivity-${activityName}` }}
    />
  )
}

export default GroupActivityGradingPrimaryLink
