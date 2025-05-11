import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import {
  ElementInstanceType,
  GroupActivity,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PublishConfirmationModal from '../modals/PublishConfirmationModal'

function PublishGroupActivityButton({
  groupActivity,
  courseId,
}: {
  groupActivity: Partial<GroupActivity> & Pick<GroupActivity, 'id' | 'name'>
  courseId: string
}) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)

  return (
    <>
      <Button
        basic
        onClick={() => setPublishModal(true)}
        className={{
          root: 'text-primary-100 hover:text-primary-100 h-7 py-0 text-sm',
        }}
        data={{ cy: `publish-groupActivity-${groupActivity.name}` }}
      >
        <Button.Icon icon={faUserGroup} />
        <Button.Label>{t('manage.course.publishGroupActivity')}</Button.Label>
      </Button>
      <PublishConfirmationModal
        open={publishModal}
        setOpen={setPublishModal}
        elementType={ElementInstanceType.GroupActivity}
        elementId={groupActivity.id}
        title={groupActivity.name}
        courseId={courseId}
        publicationHint={t('manage.course.groupActivityPublishingHint')}
      />
    </>
  )
}

export default PublishGroupActivityButton
