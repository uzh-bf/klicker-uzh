import { faCalendar } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
        onClick={() => setExtensionModal(true)}
        data={{
          cy: `extend-groupActivity-${activityName}`,
        }}
        basic
      >
        <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
          <FontAwesomeIcon icon={faCalendar} className="w-[1.2rem]" />
          <div>{t('manage.course.extendGroupActivity')}</div>
        </div>
      </Button>
      <ExtensionModal
        type="groupActivity"
        id={activityId}
        currentEndDate={scheduledEndAt}
        courseId={courseId}
        title={t('manage.course.extendGroupActivity')}
        description={t('manage.course.extendGroupActivityDescription')}
        open={extensionModal}
        setOpen={setExtensionModal}
      />
    </>
  )
}

export default GroupActivityExtensionButton
