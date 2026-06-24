import {
  faCheck,
  faExclamationCircle,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface ConfirmationItemProps {
  label: string
  confirmed: boolean
  notApplicable: boolean
  onClick: () => void
  confirmationType?: 'confirm' | 'delete'
  data?: { cy?: string; test?: string }
}

function ConfirmationItem({
  label,
  confirmed,
  notApplicable,
  onClick,
  confirmationType = 'confirm',
  data,
}: ConfirmationItemProps) {
  const t = useTranslations()
  const isConfirmed = confirmed || notApplicable
  const canConfirm = !isConfirmed
  const handleConfirm = () => {
    if (canConfirm) {
      onClick()
    }
  }

  return (
    <div
      className={twMerge(
        'flex min-h-10 flex-row items-center justify-between border-b pb-2 pl-2',
        canConfirm && 'cursor-pointer'
      )}
      data-cy={canConfirm ? data?.cy : undefined}
      data-test={canConfirm ? data?.test : undefined}
      role={canConfirm ? 'button' : undefined}
      tabIndex={canConfirm ? 0 : undefined}
      onClick={handleConfirm}
      onKeyDown={(event) => {
        if (!canConfirm) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <div className="flex flex-row items-center gap-3.5">
        <FontAwesomeIcon
          icon={notApplicable ? faInfoCircle : faExclamationCircle}
          className={twMerge(
            notApplicable
              ? 'text-primary-80'
              : confirmed
                ? 'text-gray-500'
                : 'text-red-600'
          )}
        />
        <div
          className={twMerge(
            'mr-4',
            (notApplicable || confirmed) && 'text-gray-500'
          )}
        >
          {label}
        </div>
      </div>
      {isConfirmed ? (
        <FontAwesomeIcon icon={faCheck} className="text-green-700" />
      ) : (
        <Button
          onClick={(event) => {
            event?.stopPropagation()
            onClick()
          }}
          className={{
            root: twMerge(
              'border-primary-100 h-7 py-0',
              confirmationType === 'delete' && 'border-red-600'
            ),
          }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      )}
    </div>
  )
}

export default ConfirmationItem
