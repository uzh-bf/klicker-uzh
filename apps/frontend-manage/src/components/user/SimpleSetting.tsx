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
        'flex flex-row items-center justify-between w-full py-0.5 mb-1 mt-1',
        'font-bold border-b border-solid border-gray-300 text-lg text-neutral-500'
      )}
    >
      <Label
        label={label}
        tooltip={tooltip}
        showTooltipSymbol={!!tooltip}
        className={{ tooltip: 'font-normal text-base max-w-[35rem]' }}
      />
      <>{children}</>
    </div>
  )
}

export default SimpleSetting
