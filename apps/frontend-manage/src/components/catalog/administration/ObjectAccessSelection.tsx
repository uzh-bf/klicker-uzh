import { ObjectAccess } from '@lib/constants/sharingEnums'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ObjectAccessLabel from '../ObjectAccessLabel'

function ObjectAccessSelection({
  value,
  onChange,
  compact,
  cyPrefix,
  hideTooltip,
  restrictedDisabled = false,
}: {
  value: ObjectAccess
  onChange: (value: ObjectAccess) => void
  compact?: boolean
  cyPrefix: string
  hideTooltip?: boolean
  restrictedDisabled?: boolean
}) {
  const t = useTranslations()

  return (
    <SelectField
      required
      value={value}
      onChange={(value) => onChange(value as ObjectAccess)}
      label={!compact ? t('manage.resources.access') : undefined}
      tooltip={
        !compact && !hideTooltip
          ? t('manage.resources.accessTooltip')
          : undefined
      }
      items={[
        {
          value: ObjectAccess.Restricted,
          label: <ObjectAccessLabel accessType={ObjectAccess.Restricted} />,
          disabled: restrictedDisabled,
          data: { cy: 'object-access-restricted' },
        },
        {
          value: ObjectAccess.Public,
          label: <ObjectAccessLabel accessType={ObjectAccess.Public} />,
          data: { cy: 'object-access-public' },
        },
      ]}
      data={{ cy: `${cyPrefix}-object-access` }}
      className={{
        select: {
          trigger: twMerge('h-9 w-48', compact && 'h-7 w-40 text-sm'),
          item: compact ? 'text-sm' : '',
        },
      }}
    />
  )
}

export default ObjectAccessSelection
