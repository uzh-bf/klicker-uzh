import { faCalendar } from '@fortawesome/free-regular-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ExtensionModal from '../modals/ExtensionModal'

interface GroupActivityExtensionButtonProps {
  activityId: string
  activityName: string
  scheduledEndAt: Date
  courseId: string
}

function GroupActivityExtensionButton({
  activityId,
  activityName,
  scheduledEndAt,
  courseId,
}: GroupActivityExtensionButtonProps) {
  const t = useTranslations()
  const [extensionModal, setExtensionModal] = useState(false)

  return (
    <>
      <Button
        basic
        onClick={() => setExtensionModal(true)}
        className={{
          root: 'text-primary-100 hover:text-primary-100 h-7 py-0 text-sm',
        }}
        data={{
          cy: `extend-groupActivity-${activityName}`,
        }}
      >
        <Button.Icon icon={faCalendar} />
        <Button.Label>{t('manage.course.extendGroupActivity')}</Button.Label>
      </Button>
      {extensionModal && (
        <ExtensionModal
          type="groupActivity"
          id={activityId}
          currentEndDate={scheduledEndAt}
          courseId={courseId}
          title={t('manage.course.extendGroupActivity')}
          description={t('manage.course.extendGroupActivityDescription')}
          onClose={() => setExtensionModal(false)}
        />
      )}
    </>
  )
}

export default GroupActivityExtensionButton
