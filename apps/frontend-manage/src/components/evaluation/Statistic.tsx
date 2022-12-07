import { Checkbox } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface StatisticProps {
  statisticName: string
  value: unknown
  hasCheckbox: boolean
  checked: boolean
  onCheck: () => void
  chartType: string
}

function Statistic({
  statisticName,
  value,
  hasCheckbox,
  checked,
  onCheck,
  chartType,
}: StatisticProps): React.ReactElement {
  return (
    <div className="flex justify-between mb-2 border-b-2">
      <span
        className={twMerge(
          'flex flex-row items-center',
          !hasCheckbox && chartType === 'histogram' && 'ml-6'
        )}
      >
        {hasCheckbox && chartType === 'histogram' && (
          <Checkbox
            checked={checked}
            onCheck={onCheck}
            size="sm"
            className={{ root: 'border-black rounded-sm' }}
          />
        )}
        {statisticName}
      </span>
      <span>{Math.round(parseFloat(value) * 100) / 100}</span>
    </div>
  )
}

export default Statistic
