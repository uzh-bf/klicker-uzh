import { faClock, IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { Badge } from '@uzh-bf/design-system/dist/future'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface CourseListButtonProps {
  onClick: () => void
  icon: IconDefinition
  label: string
  color?: string
  isArchived?: boolean
  startDate?: string
  endDate?: string
  data?: {
    cy?: string
    test?: string
  }
}

function CourseListButton({
  onClick,
  icon,
  label,
  color,
  isArchived,
  startDate,
  endDate,
  data,
}: CourseListButtonProps) {
  const t = useTranslations()

  return (
    <Button
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
      <div>
        <div className="ml-1 flex flex-row items-center gap-3">
          <FontAwesomeIcon icon={icon} />
          <div>{label}</div>
        </div>
        {startDate && endDate && (
          <div className="text-uzh-grey-100 ml-1 flex flex-row items-center gap-1.5 text-sm">
            <FontAwesomeIcon icon={faClock} />
            <div>
              {dayjs(startDate).format('DD.MM.YYYY').toString()} -{' '}
              {dayjs(endDate).format('DD.MM.YYYY').toString()}
            </div>
          </div>
        )}
      </div>
      {isArchived && <Badge>{t('shared.generic.archived')}</Badge>}
    </Button>
  )
}

export default CourseListButton
