import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface LiveSessionCreationToastProps {
  editMode: boolean
  open: boolean
  setOpen: (open: boolean) => void
}

function LiveSessionCreationToast({
  editMode,
  open,
  setOpen,
}: LiveSessionCreationToastProps): React.ReactElement {
  const t = useTranslations()

  return (
    <Toast
      duration={6000}
      openExternal={open}
      setOpenExternal={setOpen}
      type="success"
    >
      <div>
        {editMode ? (
          <div>{t('manage.toasts.liveSessionEdit')}</div>
        ) : (
          <div>{t('manage.toasts.liveSessionCreate')}</div>
        )}
        <div className="flex flex-row items-center">
          <FontAwesomeIcon icon={faArrowRight} className="mr-2" />
          {t.rich('manage.toasts.toSessionList', {
            link: (text) => (
              <Link href="/sessions" className="ml-1 text-primary">
                <span data-cy="load-session-list">{text}</span>
              </Link>
            ),
          })}
        </div>
      </div>
    </Toast>
  )
}

export default LiveSessionCreationToast
