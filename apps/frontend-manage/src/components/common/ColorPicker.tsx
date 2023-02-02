import { Button, Label, ThemeContext } from '@uzh-bf/design-system'
import { useContext, useState } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'

interface Props {
  color: string
  onSubmit: (newColor: string) => void
  onAbort: () => void
}

function ColorPicker({ color, onAbort, onSubmit }: Props) {
  const theme = useContext(ThemeContext)
  const [newColor, setNewColor] = useState(color)

  const presetColors = ['#262FAD', '#016272', '#5FB1F9', '#FE7408', '#D84B39']

  return (
    <div className="absolute flex flex-col p-1 bg-white rounded-md shadow-md w-80 left-10 top-8">
      <HexColorPicker
        style={{ width: 'auto' }}
        color={newColor}
        onChange={setNewColor}
      />
      <div className="grid grid-cols-5 gap-0.5 pt-3 pb-3 justify-items-center">
        {presetColors.map((presetColor, index) => (
          <button
            key={index}
            className={'h-7 w-7 rounded-2xl'}
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
        />
      </div>
      <div className="flex flex-row justify-between w-full pt-5">
        <Button
          className={{ root: 'float-right' }}
          type="submit"
          onClick={onAbort}
        >
          Abbrechen
        </Button>
        <Button
          className={{
            root: `float-right text-white disabled:opacity-60 ${theme.primaryBgDark}`,
          }}
          type="submit"
          onClick={() => onSubmit(newColor)}
          disabled={color === newColor}
        >
          Speichern
        </Button>
      </div>
    </div>
  )
}

export default ColorPicker
