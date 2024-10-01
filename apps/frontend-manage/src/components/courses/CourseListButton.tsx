import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { Badge } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface CourseListButtonProps {
  key?: string
  onClick: () => void
  icon: IconDefinition
  label: string
  color?: string
  isArchived?: boolean
  data?: {
    cy?: string
    test?: string
  }
}

function CourseListButton({
  key,
  onClick,
  icon,
  label,
  color,
  isArchived,
  data,
}: CourseListButtonProps) {
  const t = useTranslations()

  return (
    <Button
      key={key}
      className={{
        root: twMerge(
          'border-uzh-grey-100 flex w-full flex-row justify-between rounded-md border border-solid p-2',
          typeof color !== 'undefined' && '!border-b-4'
        ),
      }}
      style={{ borderBottomColor: color }}
      onClick={onClick}
      data={data}
    >
      <div className="ml-1 flex flex-row items-center gap-3">
        <FontAwesomeIcon icon={icon} />
        <div>{label}</div>
      </div>
      {isArchived && <Badge>{t('shared.generic.archived')}</Badge>}
    </Button>
  )
}

export default CourseListButton
