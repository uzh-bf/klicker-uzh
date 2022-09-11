import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as RadixSlider from '@radix-ui/react-slider'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
  value: number
  labels: Record<string, string>
  handleChange: (newValue: number) => void
  min: number
  max: number
  step: number
  disabled?: boolean
  icons?: Record<string, string>
  rangeColorMap?: Record<string, string>
  borderColorMap?: Record<string, string>
  className?: string
}

const defaultProps = {
  disabled: false,
  icons: undefined,
  rangeColorMap: undefined,
  borderColorMap: undefined,
  className: undefined,
}

function Slider({
  value,
  labels,
  handleChange,
  min,
  max,
  step,
  disabled,
  icons,
  rangeColorMap,
  borderColorMap,
  className,
}: Props): React.ReactElement {
  const steps =
    min < 0 && max > 0
      ? ((max - min + 1) / step) >> 0
      : ((max - min) / step) >> 0

  return (
    <RadixSlider.Root
      className={twMerge(
        'relative flex items-center w-full h-24 select-none',
        className
      )}
      defaultValue={[0]}
      disabled={disabled}
      max={max}
      min={min}
      step={step}
      value={[value]}
      onValueChange={([newValue]) => handleChange(newValue)}
    >
      <div className="absolute bottom-0 left-0 right-0 flex flex-row justify-between text-3xl">
        {icons?.min ? (
          <div>{icons.min}</div>
        ) : (
          <div className="text-base italic">{labels.min}</div>
        )}
        {icons?.mid ? (
          <div>{icons.mid}</div>
        ) : (
          <div className="text-base italic">{labels.mid}</div>
        )}
        {icons?.max ? (
          <div>{icons.max}</div>
        ) : (
          <div className="text-base italic">{labels.max}</div>
        )}
      </div>

      <RadixSlider.Track className="relative flex-1 h-4 bg-gray-200 rounded-xl">
        <RadixSlider.Range
          className={twMerge(
            'absolute h-full rounded-full',
            rangeColorMap && Object.keys(rangeColorMap).length === steps
              ? rangeColorMap[String(value)]
              : 'bg-gray-500'
          )}
        />
      </RadixSlider.Track>

      <RadixSlider.Thumb
        className={twMerge(
          'w-12 h-12 flex flex-col items-center justify-center bg-white border-[3px] border-solid rounded-full shadow-lg focus:outline-none',
          disabled ? 'cursor-not-allowed' : 'cursor-move',
          disabled ||
            !borderColorMap ||
            Object.keys(borderColorMap).length !== steps
            ? 'border-gray-300'
            : borderColorMap[String(value)]
        )}
      >
        {disabled && (
          <FontAwesomeIcon icon={faLock} size="lg" className="text-gray-500" />
        )}
      </RadixSlider.Thumb>
    </RadixSlider.Root>
  )
}

Slider.defaultProps = defaultProps

export default Slider
