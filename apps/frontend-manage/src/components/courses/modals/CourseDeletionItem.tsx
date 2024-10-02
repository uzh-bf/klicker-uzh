import { faCheck, faExclamationCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CourseDeletionItem({
  label,
  confirmed,
  onClick,
  data,
}: {
  label: string
  confirmed: boolean
  onClick: () => void
  data?: { cy?: string; test?: string }
}) {
  const t = useTranslations()

  return (
    <div className="flex h-10 flex-row items-center justify-between border-b pb-2">
      <div className="flex flex-row items-center gap-4">
        <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600" />
        <div className="mr-4">{label}</div>
      </div>
      {confirmed ? (
        <FontAwesomeIcon icon={faCheck} className="text-green-700" />
      ) : (
        <Button
          onClick={onClick}
          className={{ root: 'h-7 border-red-600' }}
          data={data}
        >
          {t('shared.generic.confirm')}
        </Button>
      )}
    </div>
  )
}

export default CourseDeletionItem
