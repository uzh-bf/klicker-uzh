import { Label } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface SimpleSettingProps {
  label: string
  tooltip?: string | React.ReactNode
  children: React.ReactNode
}

function SimpleSetting({ label, tooltip, children }: SimpleSettingProps) {
  return (
    <div
      className={twMerge(
        'mb-1 mt-1 flex w-full flex-row items-center justify-between py-0.5',
        'border-b border-solid border-gray-300 text-lg font-bold text-neutral-500'
      )}
    >
      <Label
        label={label}
        tooltip={tooltip}
        showTooltipSymbol={!!tooltip}
        className={{ tooltip: 'max-w-[35rem] text-base font-normal' }}
      />
      <>{children}</>
    </div>
  )
}

export default SimpleSetting
