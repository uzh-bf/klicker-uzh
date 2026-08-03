import { Slider } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface CSSliderProps {
  elementIx: number
  caseIndex: number
  itemIx: number
  criterionIx: number
  disabled: boolean
  value?: number
  onChange: (newValue: number) => void
  defaultValue: number
  min: number
  max: number
  step: number
  labels: { min?: string; mid?: string; max?: string }
  solution?: { min: number; max: number }
}

function CSSlider({
  elementIx,
  caseIndex,
  itemIx,
  criterionIx,
  disabled,
  value,
  onChange,
  defaultValue,
  min,
  max,
  step,
  labels,
  solution,
}: CSSliderProps) {
  const correct =
    typeof solution !== 'undefined' && typeof value !== 'undefined'
      ? value >= solution.min - Number.EPSILON &&
        value <= solution.max + Number.EPSILON
      : undefined

  return (
    <div className="w-full self-center">
      <Slider
        compact
        disabled={disabled}
        value={value}
        handleChange={onChange}
        defaultValue={defaultValue}
        min={min}
        max={max}
        labels={labels}
        step={step}
        className={{
          range: twMerge(
            typeof value === 'undefined' && 'bg-gray-200',
            typeof correct !== 'undefined' &&
              (correct
                ? 'bg-green-700 bg-opacity-80'
                : 'bg-red-700 bg-opacity-80')
          ),
          thumb: twMerge(
            typeof correct !== 'undefined' &&
              (correct ? 'border-green-700' : 'border-red-700')
          ),
          labels: '-mt-0.5',
          label: 'text-sm md:text-base',
        }}
        dataThumb={{
          cy: `cs-slider-${elementIx}-${caseIndex}-${itemIx}-${criterionIx}`,
        }}
      />
    </div>
  )
}

export default CSSlider
