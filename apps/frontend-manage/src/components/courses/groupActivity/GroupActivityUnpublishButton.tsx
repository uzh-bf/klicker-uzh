import { useMutation } from '@apollo/client'
import { faLock } from '@fortawesome/free-solid-svg-icons'
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

  const [unpublishGroupActivity, { loading: unpublishing }] = useMutation(
    UnpublishGroupActivityDocument,
    {
      variables: {
        id: activityId,
      },
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId } },
      ],
    }
  )

  return (
    <Button
      basic
      loading={unpublishing}
      onClick={async () => await unpublishGroupActivity()}
      className={{
        root: 'h-7 py-0 text-sm text-red-600 hover:text-red-600',
      }}
      data={{
        cy: `unpublish-groupActivity-${activityName}`,
      }}
    >
      <Button.Icon icon={faLock} loading={unpublishing} />
      <Button.Label>{t('manage.course.unpublishGroupActivity')}</Button.Label>
    </Button>
  )
}

export default GroupActivityUnpublishButton
