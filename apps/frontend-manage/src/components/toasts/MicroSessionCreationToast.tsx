import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface MicroSessionCreationToastProps {
  editMode: boolean
  courseId: string
  open: boolean
  setOpen: (open: boolean) => void
}

function MicroSessionCreationToast({
  editMode,
  courseId,
  open,
  setOpen,
}: MicroSessionCreationToastProps): React.ReactElement {
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
          <div>{t('manage.toasts.microSessionEdit')}</div>
        ) : (
          <div>{t('manage.toasts.microSessionCreate')}</div>
        )}
        <div className="flex flex-row items-center">
          <FontAwesomeIcon icon={faArrowRight} className="mr-2" />
          {t.rich('manage.toasts.toCourseOverview', {
            link: (text) => (
              <Link
                href={`/courses/${courseId}`}
                className="ml-1 text-primary"
                id="load-course-link"
                data-cy="load-course-overview"
              >
                {text}
              </Link>
            ),
          })}
        </div>
      </div>
    </Toast>
  )
}

export default MicroSessionCreationToast
