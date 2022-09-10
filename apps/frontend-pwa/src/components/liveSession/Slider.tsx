import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as RadixSlider from '@radix-ui/react-slider'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
  handleChange: any
  value: number
  disabled?: boolean
  labels: any
  icons?: any
}

const defaultProps = {
  disabled: false,
  icons: undefined,
  value: undefined,
}

const RANGE_COLOR_MAP = {
  '-2': 'bg-red-200',
  '-1': 'bg-yellow-200',
  '0': 'bg-green-200',
  '1': 'bg-yellow-200',
  '2': 'bg-red-200',
}

const BORDER_COLOR_MAP = {
  '-2': 'border-red-300',
  '-1': 'border-yellow-300',
  '0': 'border-green-300',
  '1': 'border-yellow-300',
  '2': 'border-red-300',
}

function Slider({
  value,
  disabled,
  handleChange,
  labels,
  icons,
}: Props): React.ReactElement {
  return (
    <RadixSlider.Root
      className="relative flex items-center w-full h-24 select-none"
      defaultValue={[0]}
      disabled={disabled}
      max={2}
      min={-2}
      step={1}
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
            RANGE_COLOR_MAP[String(value)]
          )}
        />
      </RadixSlider.Track>

      <RadixSlider.Thumb
        className={twMerge(
          'w-12 h-12 flex flex-col items-center justify-center bg-white border-3 border-solid rounded-full shadow-lg focus:outline-none',
          disabled ? 'cursor-not-allowed' : 'cursor-move',
          disabled ? 'border-gray-300' : BORDER_COLOR_MAP[String(value)]
        )}
      >
        {disabled && (
          <FontAwesomeIcon
            icon={faLock}
            size="lg"
            className="text-uzh-grey-100"
          />
        )}
      </RadixSlider.Thumb>
    </RadixSlider.Root>
  )
}

Slider.defaultProps = defaultProps

export default Slider
