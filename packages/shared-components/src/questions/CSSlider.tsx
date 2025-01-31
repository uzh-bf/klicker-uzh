import { Slider } from '@uzh-bf/design-system'
import React from 'react'

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
}: CSSliderProps) {
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
        step={step}
        className={{
          root: 'h-6',
          range: typeof value === 'undefined' ? 'bg-gray-200' : '',
        }}
        dataThumb={{
          cy: `cs-slider-${elementIx + 1}-${caseIndex + 1}-${itemIx + 1}-${criterionIx + 1}`,
        }}
      />
    </div>
  )
}

export default CSSlider
