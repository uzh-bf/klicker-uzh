import { faPalette } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Label, ThemeContext } from '@uzh-bf/design-system'
import { useContext, useState } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { PRESET_COURSE_COLORS } from 'shared-components/src/constants'
import { twMerge } from 'tailwind-merge'

interface ColorPickerProps {
  color: string
  onSubmit: (newColor: string) => void
  disabled?: boolean
  position?: 'bottom' | 'top'
  submitText: string
  abortText: string
  dataTrigger?: {
    cy?: string
    test?: string
  }
  dataHexInput?: {
    cy?: string
    test?: string
  }
  dataAbort?: {
    cy?: string
    test?: string
  }
  dataSubmit?: {
    cy?: string
    test?: string
  }
}

// TODO: extract this component to the design-system or at least create a formik component for it (or both in design-system)

function ColorPicker({
  color,
  onSubmit,
  disabled,
  position = 'bottom',
  submitText,
  abortText,
  dataTrigger,
  dataHexInput,
  dataAbort,
  dataSubmit,
}: ColorPickerProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const theme = useContext(ThemeContext)
  const [newColor, setNewColor] = useState(color)

  return (
    <div
      className={'flex relative w-20 rounded-lg align-center justify-end'}
      style={{ backgroundColor: color ?? '#0028A5' }}
    >
      <Button
        onClick={() => setColorPickerOpen(true)}
        disabled={disabled}
        data={dataTrigger}
      >
        <FontAwesomeIcon icon={faPalette} />
      </Button>
      {colorPickerOpen && (
        <div
          className={twMerge(
            'absolute flex flex-col p-1 bg-white rounded-md shadow-md w-80',
            position === 'bottom' && 'left-10 top-8',
            position === 'top' && 'left-10 bottom-8'
          )}
        >
          <HexColorPicker
            style={{ width: 'auto' }}
            color={newColor}
            onChange={setNewColor}
          />
          <div className="grid grid-cols-5 gap-0.5 pt-3 pb-3 justify-items-center">
            {PRESET_COURSE_COLORS.map((presetColor, index) => (
              <Button
                key={index}
                className={{ root: 'h-7 w-7 border-none rounded-2xl' }}
                style={{ backgroundColor: presetColor }}
                onClick={() => setNewColor(presetColor)}
              />
            ))}
          </div>
          <div className="flex flex-row">
            <Label
              className={{ root: 'pr-1', tooltip: 'ml-4' }}
              label="Farbe:"
              tooltip="Sie können auch direkt den Hex-Code einer Farbe eingeben"
              showTooltipSymbol
            />
            <HexColorInput
              className="w-full pl-2 border rounded border-uzh-grey-60 focus:border-uzh-blue-50 h-9 text-slate-600"
              color={newColor}
              onChange={setNewColor}
              data-cy={dataHexInput?.cy}
              data-text={dataHexInput?.test}
            />
          </div>
          <div className="flex flex-row justify-between w-full pt-5">
            <Button
              className={{ root: 'float-right' }}
              type="submit"
              onClick={() => setColorPickerOpen(false)}
              data={dataAbort}
            >
              {abortText}
            </Button>
            <Button
              className={{
                root: `float-right text-white disabled:opacity-60 ${theme.primaryBgDark}`,
              }}
              type="submit"
              onClick={() => {
                onSubmit(newColor)
                setColorPickerOpen(false)
              }}
              disabled={color === newColor}
              data={dataSubmit}
            >
              {submitText}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ColorPicker
