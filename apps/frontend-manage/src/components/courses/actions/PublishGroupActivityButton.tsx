import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceType,
  GroupActivity,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PublishConfirmationModal from '../modals/PublishConfirmationModal'

interface PublishGroupActivityButtonProps {
  groupActivity: Partial<GroupActivity> & Pick<GroupActivity, 'id' | 'name'>
}

function PublishGroupActivityButton({
  groupActivity,
}: PublishGroupActivityButtonProps) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)

  return (
    <>
      <Button
        basic
        className={{ root: 'text-primary' }}
        onClick={() => setPublishModal(true)}
        data={{ cy: `publish-groupActivity-${groupActivity.name}` }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faUserGroup} className="w-[1.1rem]" />
        </Button.Icon>
        <Button.Label>{t('manage.course.publishGroupActivity')}</Button.Label>
      </Button>
      <PublishConfirmationModal
        elementType={ElementInstanceType.GroupActivity}
        elementId={groupActivity.id}
        title={groupActivity.name}
        publicationHint={t('manage.course.groupActivityPublishingHint')}
        open={publishModal}
        setOpen={setPublishModal}
      />
    </>
  )
}

export default PublishGroupActivityButton
