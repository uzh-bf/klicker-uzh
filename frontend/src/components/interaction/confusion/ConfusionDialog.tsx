import React from 'react'
import { Button } from 'semantic-ui-react'
import * as Slider from '@radix-ui/react-slider'

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

function ConfusionLabel({ icon, label }) {
  return (
    <div className="flex flex-row items-center text-xl">
      {icon && <i className="icon">{icon}</i>}
      {label}
    </div>
  )
}

function ConfusionButton({ children, value, changeValue, onClick, disabled, withIcon }) {
  return (
    <Button
      basic
      className="flex-1 !mr-0"
      color={value === changeValue ? 'blue' : undefined}
      disabled={disabled}
      icon={withIcon}
      labelPosition={withIcon ? 'left' : undefined}
      size="tiny"
      onClick={() => onClick(changeValue)}
    >
      {children}
    </Button>
  )
}

function ConfusionDialog({ title, value, disabled, handleChange, labels, icons }: Props): React.ReactElement {
  return (
    <div>
      <div className="flex flex-col gap-1 md:text-left">
        {title && <h2 className="!mb-0 !text-base md:w-24">{title}</h2>}
        <div className="flex flex-row flex-wrap gap-2">
          <ConfusionButton
            changeValue={-1}
            disabled={disabled}
            value={value}
            withIcon={!!icons?.min}
            onClick={handleChange}
          >
            {icons?.min && <i className="icon">{icons.min}</i>}
            {labels.min}
          </ConfusionButton>
          <ConfusionButton
            changeValue={0}
            disabled={disabled}
            value={value}
            withIcon={!!icons?.mid}
            onClick={handleChange}
          >
            {icons?.mid && <i className="icon">{icons.mid}</i>}
            {labels.mid}
          </ConfusionButton>
          <ConfusionButton
            changeValue={1}
            disabled={disabled}
            value={value}
            withIcon={!!icons?.max}
            onClick={handleChange}
          >
            {icons?.max && <i className="icon">{icons.max}</i>}
            {labels.max}
          </ConfusionButton>
        </div>
        <div>
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
            <Slider.Track className="relative flex-1 h-3 bg-gray-300 rounded">
              <Slider.Range className="absolute h-full bg-red-400 rounded-full" />
            </Slider.Track>
            <Slider.Thumb className="block p-1 bg-white border border-solid rounded-full shadow-lg cursor-move">
              <div className="text-3xl">{icons.mid}</div>
            </Slider.Thumb>
          </Slider.Root>
          <div className="flex flex-row justify-between">
            <div>{icons.min}</div>
            <div>{icons.mid}</div>
            <div>{icons.max}</div>
          </div>
        </div>
        {/* <div className="mt-8 mb-8 px-28">
          <Slider
            disabled={!isConfusionEnabled}
            dotStyle={{
              width: 10,
              height: 10,
            }}
            handleStyle={{
              width: 20,
              height: 20,
            }}
            included={false}
            marks={{
              '-1': {
                label: <ConfusionLabel icon={icons?.min} label={labels.min} />,
                style: {
                  color: 'rgba(240, 43, 30, 0.7)',
                },
              },
              '-0.5': {
                label: <ConfusionLabel label={`rather ${labels.min}`} />,
                style: {
                  color: 'rgba(245, 114, 0, 0.7)',
                },
              },
              '0': {
                label: <ConfusionLabel icon={icons?.mid} label={labels.mid} />,
                style: {
                  color: 'rgba(22, 171, 57, 0.7)',
                },
              },
              '0.5': {
                label: <ConfusionLabel label={`rather ${labels.max}`} />,
                style: {
                  color: 'rgba(245, 114, 0, 0.7)',
                },
              },
              '1': {
                label: <ConfusionLabel icon={icons?.max} label={labels.max} />,
                style: {
                  color: 'rgba(240, 43, 30, 0.7)',
                },
              },
            }}
            max={1}
            min={-1}
            step={0.5}
            onAfterChange={handleClick}
          />
        </div> */}
      </div>
    </div>
  )
}

ConfusionDialog.defaultProps = defaultProps

export default ConfusionDialog
