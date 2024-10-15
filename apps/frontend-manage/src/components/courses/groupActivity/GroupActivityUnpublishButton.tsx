import { useMutation } from '@apollo/client'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSingleCourseDocument,
  UnpublishGroupActivityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface GroupActivityUnpublishButtonProps {
  activityId: string
  activityName: string
  courseId: string
}

function GroupActivityUnpublishButton({
  activityId,
  activityName,
  courseId,
}: GroupActivityUnpublishButtonProps) {
  const t = useTranslations()

  const [unpublishGroupActivity] = useMutation(UnpublishGroupActivityDocument, {
    variables: {
      id: activityId,
    },
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId } },
    ],
  })

  return (
    <Button
      onClick={async () => await unpublishGroupActivity()}
      data={{
        cy: `unpublish-groupActivity-${activityName}`,
      }}
      basic
    >
      <div className="flex cursor-pointer flex-row items-center gap-1 text-red-600">
        <FontAwesomeIcon icon={faLock} className="w-[1.1rem]" />
        <div>{t('manage.course.unpublishGroupActivity')}</div>
      </div>
    </Button>
  )
}

export default GroupActivityUnpublishButton
