import * as Slider from '@radix-ui/react-slider'
import React from 'react'
import { Icon } from 'semantic-ui-react'
import { twMerge } from 'tailwind-merge'

interface Props {
  disabled?: boolean
  handleChange: any
  labels: any
  icons?: any
  title: React.ReactNode
  value?: number
}

const defaultProps = {
  disabled: false,
  title: undefined,
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

function ConfusionDialog({ title, value, disabled, handleChange, labels, icons }: Props): React.ReactElement {
  return (
    <div className="flex flex-col md:text-left">
      {title && <h2 className="!mb-[-20px] !text-base md:w-24 text-gray-600">{title}</h2>}
      <Slider.Root
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
          <i className="icon !mr-0">{icons.min || labels.min}</i>
          <i className="icon !mr-0">{icons.mid || labels.mid}</i>
          <i className="icon !mr-0">{icons.max || labels.max}</i>
        </div>

        <Slider.Track className="relative flex-1 h-4 bg-gray-200 rounded-xl">
          <Slider.Range className={twMerge('absolute h-full rounded-full', RANGE_COLOR_MAP[String(value)])} />
        </Slider.Track>

        <Slider.Thumb
          className={twMerge(
            'w-12 h-12 flex flex-col items-center justify-center bg-white border-3 border-solid rounded-full shadow-lg focus:outline-none',
            disabled ? 'cursor-not-allowed' : 'cursor-move',
            disabled ? 'border-gray-300' : BORDER_COLOR_MAP[value]
          )}
        >
          {disabled && <Icon className="!mr-0 text-gray-400" name="lock" />}
        </Slider.Thumb>
      </Slider.Root>
    </div>
  )
}

ConfusionDialog.defaultProps = defaultProps

export default ConfusionDialog
