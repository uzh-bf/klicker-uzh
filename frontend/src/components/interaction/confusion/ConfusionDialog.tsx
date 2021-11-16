import React from 'react'
import { Icon, Button } from 'semantic-ui-react'
import * as Slider from '@radix-ui/react-slider'
import clsx from 'clsx'

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
  '-1': 'bg-red-200',
  '-0.5': 'bg-yellow-200',
  '0': 'bg-green-200',
  '0.5': 'bg-yellow-200',
  '1': 'bg-red-200',
}

const BORDER_COLOR_MAP = {
  '-1': 'border-red-300',
  '-0.5': 'border-yellow-300',
  '0': 'border-green-300',
  '0.5': 'border-yellow-300',
  '1': 'border-red-300',
}

function ConfusionDialog({ title, value, disabled, handleChange, labels, icons }: Props): React.ReactElement {
  return (
    <div className="flex flex-col md:text-left">
      {title && <h2 className="!mb-[-20px] !text-base md:w-24 text-gray-600">{title}</h2>}
      <Slider.Root
        className="relative flex items-center w-full h-20 select-none"
        defaultValue={[0]}
        disabled={disabled}
        max={1}
        min={-1}
        step={0.5}
        value={[value]}
        onValueChange={([newValue]) => handleChange(newValue)}
      >
        <div className="absolute bottom-0 left-0 right-0 flex flex-row justify-between mt-[-50px] text-3xl z-0">
          <i className="icon !mr-0">{icons.min}</i>
          <i className="icon !mr-0 z-0">{icons.mid}</i>
          <i className="icon !mr-0">{icons.max}</i>
        </div>
        <Slider.Track className="relative flex-1 h-3 bg-gray-300 rounded">
          <Slider.Range className={clsx('absolute h-full rounded-full', RANGE_COLOR_MAP[String(value)])} />
        </Slider.Track>
        <Slider.Thumb
          className={clsx(
            'w-12 h-12 flex flex-col items-center justify-center bg-white border-3 border-solid rounded-full shadow-lg z-10',
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
