import { faMessage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo } from 'react'

/**
 * A hook that returns an activity log action item for dropdown menus
 * Can be used across all components with dropdown menus to ensure consistency
 */
function useActivityLogAction({
  objectId,
  setActivityLogOpen,
}: {
  objectId: string | number
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  return useMemo(() => {
    return {
      id: 'activity-log',
      label: (
        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
          <FontAwesomeIcon icon={faMessage} className="mr-2.5 h-4 w-4" />
          {t('shared.activity.viewActivityLog')}
        </div>
      ),
      onClick: (e: React.MouseEvent) => {
        if (e) {
          e.stopPropagation()
          e.preventDefault()
        }
        setActivityLogOpen(true)
      },
      data: { cy: `view-activity-log-${objectId}` },
    }
  }, [objectId, setActivityLogOpen, t])
}

export default useActivityLogAction
