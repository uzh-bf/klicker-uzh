import { Checkbox } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface StatisticProps {
  statisticName: string
  value: number
  hasCheckbox: boolean
  checked: boolean
  onCheck: () => void
  chartType: string
  size: string
}

function Statistic({
  statisticName,
  value,
  hasCheckbox,
  checked,
  onCheck,
  chartType,
  size,
}: StatisticProps): React.ReactElement {
  return (
    <div className="mb-2 flex justify-between border-b-2">
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
            size={
              size === 'sm' || size === 'md' || size === 'lg' || size === 'xl'
                ? size
                : 'md'
            }
            className={{ root: 'mr-1 rounded-sm border-black' }}
          />
        )}
        {statisticName}
      </span>
      <span>{Math.round(parseFloat(String(value)) * 100) / 100}</span>
    </div>
  )
}

export default Statistic
